import { ChatMessage } from '../types/chat';

export function parseChatContent(content: string): ChatMessage[] {
  const lines = content.split('\n');
  const messages: ChatMessage[] = [];
  let currentDate = '';
  let currentMessage: { id: string; textLines: string[]; timestamp: string; date: string; done: boolean } | null = null;

  for (const line of lines) {
    const dateMatch = line.match(/^#### (.+)$/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const msgMatch = line.match(/^- \[([ xX])\] `(\d{2}:\d{2})` (.*)$/);
    if (msgMatch) {
      if (currentMessage) {
        messages.push({
          id: currentMessage.id,
          text: currentMessage.textLines.join('\n'),
          timestamp: currentMessage.timestamp,
          date: currentMessage.date,
          done: currentMessage.done,
        });
      }
      currentMessage = {
        id: generateMessageId(msgMatch[2], msgMatch[3]),
        textLines: [msgMatch[3]],
        timestamp: msgMatch[2],
        date: currentDate || new Date().toDateString(),
        done: msgMatch[1] === 'x' || msgMatch[1] === 'X',
      };
      continue;
    }

    const continuationMatch = line.match(/^  (.*)$/);
    if (continuationMatch && currentMessage) {
      currentMessage.textLines.push(continuationMatch[1]);
      continue;
    }

    if (currentMessage && line.trim() === '') {
      messages.push({
        id: currentMessage.id,
        text: currentMessage.textLines.join('\n'),
        timestamp: currentMessage.timestamp,
        date: currentMessage.date,
        done: currentMessage.done,
      });
      currentMessage = null;
    }
  }

  if (currentMessage) {
    messages.push({
      id: currentMessage.id,
      text: currentMessage.textLines.join('\n'),
      timestamp: currentMessage.timestamp,
      date: currentMessage.date,
      done: currentMessage.done,
    });
  }

  return messages;
}

export function generateChatContent(messages: ChatMessage[]): string {
  const messagesByDate: Record<string, ChatMessage[]> = {};
  messages.forEach(msg => {
    const date = msg.date;
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(msg);
  });

  let content = '';
  Object.entries(messagesByDate).forEach(([date, msgs]) => {
    if (content) content += '\n';
    content += `#### ${date}\n`;
    msgs.forEach(msg => {
      const lines = msg.text.split('\n');
      content += `- [${msg.done ? 'x' : ' '}] \`${msg.timestamp}\` ${lines[0]}\n`;
      for (let i = 1; i < lines.length; i++) {
        content += `  ${lines[i]}\n`;
      }
    });
  });

  return content.trim();
}

export function generateMessageId(timestamp: string, text: string): string {
  let hash = 0;
  const str = timestamp + text;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function generateTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateTodayHeader(): string {
  const now = new Date();
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];
  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const day = now.getDate();
  const dayIndex = now.getDay();
  
  return `${year}年${monthNames[monthIndex]}${day}日，${dayNames[dayIndex]}`;
}

export function generateJournalFilename(): string {
  const now = new Date();
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];
  const monthIndex = now.getMonth();
  const year = now.getFullYear();
  const month = String(monthIndex + 1).padStart(2, '0');
  
  return `${year}.${month} ${monthNames[monthIndex]}.md`;
}