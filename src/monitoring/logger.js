/**
 * Structured logging and monitoring utilities
 */

/**
 * Log levels enum
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.CRITICAL]: 'CRITICAL'
};

/**
 * Logger class for structured logging
 */
export class Logger {
  constructor(options = {}) {
    this.minLevel = options.minLevel || LogLevel.INFO;
    this.context = options.context || {};
    this.enableConsole = options.enableConsole !== false;
    this.enableMetrics = options.enableMetrics !== false;
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context = {}) {
    return new Logger({
      minLevel: this.minLevel,
      context: { ...this.context, ...context },
      enableConsole: this.enableConsole,
      enableMetrics: this.enableMetrics
    });
  }
  
  /**
   * Log a message with structured data
   */
  log(level, message, data = {}) {
    if (level < this.minLevel) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevelNames[level],
      message,
      ...this.context,
      ...data,
      // Add request ID if available
      ...(globalThis.requestId && { requestId: globalThis.requestId })
    };
    
    // Console output for development
    if (this.enableConsole) {
      const logMethod = level >= LogLevel.ERROR ? 'error' : 
                       level >= LogLevel.WARN ? 'warn' : 'log';
      console[logMethod](JSON.stringify(logEntry));
    }
    
    // Collect metrics
    if (this.enableMetrics) {
      this.collectMetrics(level, message, data);
    }
    
    return logEntry;
  }
  
  /**
   * Collect metrics from log entries
   */
  collectMetrics(level, message, data) {
    // Basic metrics collection - in production would send to external service
    if (!globalThis.logMetrics) {
      globalThis.logMetrics = {
        counts: {},
        errors: [],
        performance: []
      };
    }
    
    const metrics = globalThis.logMetrics;
    
    // Count by level
    const levelName = LogLevelNames[level];
    metrics.counts[levelName] = (metrics.counts[levelName] || 0) + 1;
    
    // Track errors
    if (level >= LogLevel.ERROR) {
      metrics.errors.push({
        timestamp: Date.now(),
        message,
        data,
        level: levelName
      });
      
      // Keep only recent errors (last 100)
      if (metrics.errors.length > 100) {
        metrics.errors = metrics.errors.slice(-100);
      }
    }
    
    // Track performance data
    if (data.duration) {
      metrics.performance.push({
        timestamp: Date.now(),
        operation: data.operation || 'unknown',
        duration: data.duration,
        success: data.success !== false
      });
      
      // Keep only recent performance data (last 500)
      if (metrics.performance.length > 500) {
        metrics.performance = metrics.performance.slice(-500);
      }
    }
  }
  
  debug(message, data = {}) {
    return this.log(LogLevel.DEBUG, message, data);
  }
  
  info(message, data = {}) {
    return this.log(LogLevel.INFO, message, data);
  }
  
  warn(message, data = {}) {
    return this.log(LogLevel.WARN, message, data);
  }
  
  error(message, data = {}) {
    return this.log(LogLevel.ERROR, message, data);
  }
  
  critical(message, data = {}) {
    return this.log(LogLevel.CRITICAL, message, data);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  context: { service: 'fbl-gothic-library' }
});

/**
 * Request logger middleware
 */
export function createRequestLogger(request) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  
  // Store request ID globally for this request context
  globalThis.requestId = requestId;
  
  return logger.child({
    requestId,
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('User-Agent')?.substring(0, 100),
    ip: request.headers.get('CF-Connecting-IP') || 'unknown'
  });
}

/**
 * Performance measurement utility
 */
export class PerformanceTracker {
  constructor(operation, logger) {
    this.operation = operation;
    this.logger = logger;
    this.startTime = Date.now();
    this.metadata = {};
  }
  
  addMetadata(key, value) {
    this.metadata[key] = value;
    return this;
  }
  
  finish(success = true, additionalData = {}) {
    const duration = Date.now() - this.startTime;
    
    this.logger.info(`Operation completed: ${this.operation}`, {
      operation: this.operation,
      duration,
      success,
      ...this.metadata,
      ...additionalData
    });
    
    return duration;
  }
  
  error(error, additionalData = {}) {
    const duration = Date.now() - this.startTime;
    
    this.logger.error(`Operation failed: ${this.operation}`, {
      operation: this.operation,
      duration,
      success: false,
      error: error.message,
      stack: error.stack,
      ...this.metadata,
      ...additionalData
    });
    
    return duration;
  }
}

/**
 * Security event logger
 */
export function logSecurityEvent(event, data = {}) {
  logger.warn(`Security event: ${event}`, {
    securityEvent: event,
    timestamp: Date.now(),
    ...data
  });
}

/**
 * Database operation logger
 */
export function logDatabaseOperation(operation, table, duration, success, error = null) {
  const logData = {
    operation: 'database',
    dbOperation: operation,
    table,
    duration,
    success
  };
  
  if (error) {
    logData.error = error.message;
    logger.error(`Database operation failed: ${operation} on ${table}`, logData);
  } else {
    logger.info(`Database operation: ${operation} on ${table}`, logData);
  }
}

/**
 * Get current metrics snapshot
 */
export function getMetricsSnapshot() {
  if (!globalThis.logMetrics) {
    return {
      counts: {},
      errors: [],
      performance: [],
      timestamp: Date.now()
    };
  }
  
  const metrics = globalThis.logMetrics;
  
  // Calculate performance statistics
  const perfStats = {};
  if (metrics.performance.length > 0) {
    const recentPerf = metrics.performance.filter(p => 
      Date.now() - p.timestamp < 60000 // Last minute
    );
    
    const operations = {};
    for (const perf of recentPerf) {
      if (!operations[perf.operation]) {
        operations[perf.operation] = {
          count: 0,
          totalDuration: 0,
          successes: 0,
          failures: 0
        };
      }
      
      const op = operations[perf.operation];
      op.count++;
      op.totalDuration += perf.duration;
      if (perf.success) {
        op.successes++;
      } else {
        op.failures++;
      }
    }
    
    for (const [operation, stats] of Object.entries(operations)) {
      perfStats[operation] = {
        count: stats.count,
        averageDuration: Math.round(stats.totalDuration / stats.count),
        successRate: Math.round((stats.successes / stats.count) * 100) / 100,
        requestsPerMinute: stats.count
      };
    }
  }
  
  return {
    counts: { ...metrics.counts },
    recentErrors: metrics.errors.slice(-10), // Last 10 errors
    performance: perfStats,
    timestamp: Date.now(),
    uptime: Date.now() - (globalThis.startTime || Date.now())
  };
}