use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use log::{error, warn, info, debug};
use prometheus::{register_gauge, Gauge};
use tokio::time::sleep;

use crate::config::Config;

lazy_static::lazy_static! {
    static ref CONSECUTIVE_ERRORS_GAUGE: Gauge = register_gauge!(
        "lumenqraph_consecutive_errors",
        "Number of consecutive errors in the indexer polling loop"
    ).unwrap();
}

pub struct Poller {
    config: Config,
    consecutive_errors: Arc<AtomicU32>,
    last_success: Option<Instant>,
    current_backoff: Duration,
    in_circuit_breaker: bool,
}

impl Poller {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            consecutive_errors: Arc::new(AtomicU32::new(0)),
            last_success: None,
            current_backoff: Duration::from_secs(1),
            in_circuit_breaker: false,
        }
    }

    pub async fn run(&mut self) -> Result<(), PollerError> {
        info!("Starting indexer polling loop with circuit breaker (max consecutive errors: {})", 
              self.config.max_consecutive_errors);

        loop {
            match self.poll_once().await {
                Ok(()) => {
                    self.on_success();
                }
                Err(e) => {
                    self.on_error(&e).await;
                }
            }

            // Sleep before next iteration
            let sleep_duration = if self.in_circuit_breaker {
                self.config.circuit_breaker_interval
            } else {
                self.current_backoff
            };

            debug!("Sleeping for {:?} before next poll", sleep_duration);
            sleep(sleep_duration).await;
        }
    }

    async fn poll_once(&self) -> Result<(), PollerError> {
        // Simulate polling logic - replace with actual RPC calls
        // This is where you would implement the actual polling logic
        // For example:
        // - Fetch latest ledger from RPC
        // - Process transactions
        // - Update database
        
        // Placeholder implementation
        if std::env::var("SIMULATE_RPC_FAILURE").is_ok() {
            return Err(PollerError::RpcFailure("Simulated RPC failure".to_string()));
        }
        
        Ok(())
    }

    fn on_success(&mut self) {
        let previous_errors = self.consecutive_errors.swap(0, Ordering::Relaxed);
        
        if previous_errors > 0 {
            info!("Polling recovered after {} consecutive errors", previous_errors);
        }

        if self.in_circuit_breaker {
            info!("Circuit breaker reset - returning to normal polling");
            self.in_circuit_breaker = false;
        }

        self.last_success = Some(Instant::now());
        self.current_backoff = Duration::from_secs(1); // Reset backoff
        
        // Update Prometheus metric
        CONSECUTIVE_ERRORS_GAUGE.set(0.0);
    }

    async fn on_error(&mut self, error: &PollerError) {
        let error_count = self.consecutive_errors.fetch_add(1, Ordering::Relaxed) + 1;
        
        error!("Polling failed (error #{}): {}", error_count, error);
        
        // Update Prometheus metric
        CONSECUTIVE_ERRORS_GAUGE.set(error_count as f64);
        
        // Increment database error counter (placeholder)
        self.increment_errors_total().await;
        
        // Check if we should enter circuit breaker mode
        if error_count >= self.config.max_consecutive_errors && !self.in_circuit_breaker {
            self.enter_circuit_breaker();
        }
        
        // Apply exponential backoff if not in circuit breaker mode
        if !self.in_circuit_breaker {
            self.apply_backoff();
        }
    }

    fn enter_circuit_breaker(&mut self) {
        error!(
            "Entering circuit breaker mode after {} consecutive failures. \
             Will retry every {:?} instead of exponential backoff.",
            self.config.max_consecutive_errors,
            self.config.circuit_breaker_interval
        );
        
        self.in_circuit_breaker = true;
    }

    fn apply_backoff(&mut self) {
        self.current_backoff = std::cmp::min(
            self.current_backoff * 2,
            self.config.max_backoff
        );
        
        warn!("Applying exponential backoff: {:?}", self.current_backoff);
    }

    async fn increment_errors_total(&self) {
        // Placeholder for database error counter increment
        // In a real implementation, this would increment a counter in the database
        debug!("Incrementing errors_total counter in database");
    }

    pub fn get_consecutive_errors(&self) -> u32 {
        self.consecutive_errors.load(Ordering::Relaxed)
    }

    pub fn is_in_circuit_breaker(&self) -> bool {
        self.in_circuit_breaker
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PollerError {
    #[error("RPC failure: {0}")]
    RpcFailure(String),
    
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker_activation() {
        let config = Config {
            max_consecutive_errors: 3,
            circuit_breaker_interval: Duration::from_millis(100),
            contract_ids: vec!["CTEST123".to_string()],
            rpc_url: "http://localhost".to_string(),
            polling_interval: Duration::from_millis(50),
            max_backoff: Duration::from_secs(1),
        };

        let mut poller = Poller::new(config);

        // Simulate 3 consecutive errors
        for _ in 0..3 {
            poller.on_error(&PollerError::RpcFailure("test".to_string())).await;
        }

        assert!(poller.is_in_circuit_breaker());
        assert_eq!(poller.get_consecutive_errors(), 3);
    }

    #[tokio::test]
    async fn test_circuit_breaker_reset() {
        let config = Config {
            max_consecutive_errors: 2,
            circuit_breaker_interval: Duration::from_millis(100),
            contract_ids: vec!["CTEST123".to_string()],
            rpc_url: "http://localhost".to_string(),
            polling_interval: Duration::from_millis(50),
            max_backoff: Duration::from_secs(1),
        };

        let mut poller = Poller::new(config);

        // Enter circuit breaker mode
        for _ in 0..2 {
            poller.on_error(&PollerError::RpcFailure("test".to_string())).await;
        }
        assert!(poller.is_in_circuit_breaker());

        // Successful poll should reset circuit breaker
        poller.on_success();
        assert!(!poller.is_in_circuit_breaker());
        assert_eq!(poller.get_consecutive_errors(), 0);
    }
}