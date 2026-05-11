import log from 'electron-log';
import { app } from 'electron';

// Configure electron-log
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// Set log file path to app logs directory
if (app.isReady()) {
  log.transports.file.resolvePathFn = () => `${app.getPath('logs')}/orca.log`;
} else {
  app.once('ready', () => {
    log.transports.file.resolvePathFn = () => `${app.getPath('logs')}/orca.log`;
  });
}

export const logger = {
  debug: (msg: string) => log.debug(msg),
  info: (msg: string) => log.info(msg),
  warn: (msg: string) => log.warn(msg),
  error: (msg: string) => log.error(msg),
};
