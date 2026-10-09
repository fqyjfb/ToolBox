// Windows Task Scheduler 计划任务管理：通过 schtasks 在系统层面注册/删除/对账任务。
// 到时间由系统自动触发（以 --reminder=<id> 参数启动应用第二实例），无需轮询，零 CPU 占用。
// 注册统一走 XML 模板（/create /xml），显式关闭电池策略并开启 StartWhenAvailable；
// schtasks 失败不阻断业务流程：数据库记录始终为权威源，下次启动 reconcileTasks 自动修复。
// 计划任务只负责在「下一次」时刻唤醒应用，重复推进由 fireReminder 用 rrule 重算并重建任务。
const { exec } = require('child_process');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// 与 src/constants/reminder.ts 的 SCHEDULER_TASK_PREFIX 保持一致
const SCHEDULER_TASK_PREFIX = 'ToolBox_Reminder_';

const taskName = (id) => `${SCHEDULER_TASK_PREFIX}${id}`;

// 提醒触发索引：计划任务唤醒时命令行只有 id，无法定位所属用户库，
// 故注册任务时另存一份与用户名、数据库无关的弹出信息。
function triggerIndexPath() {
  return path.join(app.getPath('userData'), 'reminder-triggers.json');
}

function readTriggerIndex() {
  try {
    return JSON.parse(fs.readFileSync(triggerIndexPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeTriggerIndex(index) {
  try {
    fs.writeFileSync(triggerIndexPath(), JSON.stringify(index));
  } catch (err) {
    console.error('[reminderScheduler] 写入提醒触发索引失败:', err.message);
  }
}

// 供 main.cjs 在记录已不在任何库时兜底读取提醒内容，无需打开业务数据库
function getTriggerInfo(id) {
  return readTriggerIndex()[id] || null;
}

// 计划任务执行目标：打包后为 .exe；开发模式下为 electron.exe + 项目根目录
function getExecTarget() {
  if (app.isPackaged) {
    return { command: process.execPath, args: '' };
  }
  return { command: process.execPath, args: `"${path.join(__dirname, '..', '..')}"` };
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 生成「下一次」触发的 TimeTrigger：不再按 repeat_type 生成 CalendarTrigger。
// 重复推进统一由 fireReminder 用 rrule 算出下一次 remind_time 后重建任务，
// 只保留单次触发器可消除「OS 自重复 + 应用重算」两套重复逻辑并存导致的重复响/漏响。
// StartBoundary 一律取提醒的本地时间
// （remind_time 无时区后缀即本地时间，toISOString() 的 UTC 会让日期跨天错位）
function buildTriggerXml(reminder) {
  const dt = new Date(reminder.remind_time);
  const pad = (n) => String(n).padStart(2, '0');
  const startBoundary = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
  return `<TimeTrigger><StartBoundary>${startBoundary}</StartBoundary><Enabled>true</Enabled></TimeTrigger>`;
}

// 生成计划任务 XML：关闭「电池供电不启动」策略、开启 StartWhenAvailable（错过后尽快补跑由系统兜底）。
// MultipleInstancesPolicy 必须为 Parallel：被计划任务唤醒的应用不会退出（点关闭只是隐藏窗口、托盘常驻），
// IgnoreNew 会让系统把该任务后续的触发判定为「已有实例在跑」而直接丢弃，
// 表现为重复提醒只响一次、以及重启后到点毫无反应。
function buildTaskXml(reminder) {
  const { command, args: baseArgs } = getExecTarget();
  const argumentsText = `${baseArgs}${baseArgs ? ' ' : ''}--reminder=${reminder.id}`;
  // InteractiveToken 以当前登录用户身份运行，无需密码、无需管理员权限
  const userId = process.env.USERDOMAIN && process.env.USERNAME
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : process.env.USERNAME || '';

  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>${buildTriggerXml(reminder)}</Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${xmlEscape(userId)}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(command)}</Command>
      <Arguments>${xmlEscape(argumentsText)}</Arguments>
    </Exec>
  </Actions>
</Task>`;
}

// 通过临时 XML 文件注册任务，结束后立即删除临时文件（UTF-16LE BOM，避免非 ASCII 路径乱码）
function registerTask(reminder) {
  return new Promise((resolve) => {
    const xmlPath = path.join(app.getPath('temp'), `toolbox-reminder-${reminder.id}.xml`);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { fs.unlinkSync(xmlPath); } catch { /* 临时文件清理失败不影响注册结果 */ }
      resolve();
    };

    try {
      const xmlBuffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(buildTaskXml(reminder), 'utf16le')]);
      fs.writeFileSync(xmlPath, xmlBuffer);
      exec(`schtasks /create /tn "${taskName(reminder.id)}" /xml "${xmlPath}" /f`, { windowsHide: true }, (err, _stdout, stderr) => {
        if (err) {
          console.error(`[reminderScheduler] registerTask failed for ${reminder.id}:`, err.message, stderr || '');
        }
        finish();
      });
    } catch (err) {
      console.error(`[reminderScheduler] registerTask failed for ${reminder.id}:`, err.message);
      finish();
    }
  });
}

function buildDeleteCommand(id) {
  return `schtasks /delete /tn "${taskName(id)}" /f`;
}

// 删除计划任务（任务不存在不算错误，始终 resolve）；同时清理触发索引条目
function removeTask(id) {
  if (id) {
    const index = readTriggerIndex();
    if (index[id]) {
      delete index[id];
      writeTriggerIndex(index);
    }
  }
  return new Promise((resolve) => {
    exec(buildDeleteCommand(id), { windowsHide: true }, (err) => {
      if (err && !/cannot find|找不到|未找到/i.test(err.message)) {
        console.warn(`[reminderScheduler] removeTask ${id}:`, err.message);
      }
      resolve();
    });
  });
}

// 创建/更新计划任务（先删旧任务与索引，再写索引、注册新任务）
async function scheduleTask(reminder) {
  if (!reminder || !reminder.is_enabled) {
    await removeTask(reminder ? reminder.id : null);
    return;
  }
  await removeTask(reminder.id);
  // 必须晚于上面的 removeTask，否则索引会被清掉
  const index = readTriggerIndex();
  index[reminder.id] = {
    // id/user_id 一并使用：触发后回写状态需定位记录及其所属用户分区
    id: reminder.id,
    user_id: reminder.user_id,
    title: reminder.title,
    content: reminder.content || '',
    notify_method: reminder.notify_method,
    repeat_type: reminder.repeat_type || 'none',
    remind_time: reminder.remind_time,
  };
  writeTriggerIndex(index);
  await registerTask(reminder);
}

// 查询系统中现存的全部提醒任务 id
function queryExistingTaskIds() {
  return new Promise((resolve) => {
    exec('schtasks /query /fo CSV /nh | findstr "ToolBox_Reminder_"', { windowsHide: true }, (_err, stdout) => {
      const ids = new Set();
      if (stdout) {
        for (const line of stdout.split('\n')) {
          const match = line.match(/ToolBox_Reminder_([^,"]+)/);
          if (match) ids.add(match[1]);
        }
      }
      resolve(ids);
    });
  });
}

// 启动对账：以「全部用户库」的启用提醒为权威白名单——
// 白名单外的任务确认为孤儿后删除，启用任务串行覆盖重建（旧命令行任务随之迁移为 XML 设置）。
// 串行 await 避免「已删未建」空洞；单条失败只记日志、继续下一条。
async function reconcileTasks(reminders) {
  const enabled = Array.isArray(reminders)
    ? reminders.filter((r) => r && r.id && r.is_enabled)
    : [];
  const enabledIds = new Set(enabled.map((r) => r.id));

  const existingIds = await queryExistingTaskIds();
  for (const taskId of existingIds) {
    if (!enabledIds.has(taskId)) {
      await removeTask(taskId);
    }
  }
  for (const reminder of enabled) {
    await scheduleTask(reminder);
  }
}

module.exports = { scheduleTask, removeTask, reconcileTasks, getTriggerInfo };
