process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
  console.error(err.stack);
  process.exit(1);
});

console.log('[test] start');
const electron = require('electron');
console.log('[test] electron type:', typeof electron);
console.log('[test] electron keys:', Object.keys(electron || {}));
const app = electron && electron.app;
console.log('[test] app type:', typeof app);
if (app) {
  console.log('[test] app.isReady:', typeof app.isReady);
  console.log('[test] app.getPath type:', typeof app.getPath);
  try {
    const ud = app.getPath('userData');
    console.log('[test] userData:', ud);
  } catch (e) {
    console.error('[test] getPath error:', e.message);
  }
}
console.log('[test] end');
setTimeout(() => process.exit(0), 1000);