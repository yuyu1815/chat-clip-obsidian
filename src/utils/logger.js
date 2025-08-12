// Lightweight logger with contextual prefix and level control
// Usage:
//   import { logger } from './logger.js'
//   const log = logger.create('Content');
//   log.debug('message');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function getConfiguredLevel() {
  try {
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('chatvault:log-level')) || 'info';
    const level = (stored || 'info').toLowerCase();
    return LEVELS[level] ? level : 'info';
  } catch (_e) {
    // localStorage may be unavailable in service worker; default to info
    return 'info';
  }
}

function createLogger(context = 'App') {
  const levelName = getConfiguredLevel();
  const threshold = LEVELS[levelName];

  const prefix = `[ChatVault][${context}]`;
  const should = (lvl) => LEVELS[lvl] >= threshold;

  return {
    debug: (...args) => should('debug') && console.debug(prefix, ...args),
    info: (...args) => should('info') && console.info(prefix, ...args),
    warn: (...args) => should('warn') && console.warn(prefix, ...args),
    error: (...args) => should('error') && console.error(prefix, ...args),
  };
}

export const logger = {
  create: createLogger,
  setLevel(level) {
    try {
      if (!LEVELS[level]) return;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('chatvault:log-level', level);
      }
    } catch (_e) { /* noop */ }
  },
  getLevel: getConfiguredLevel,
};


