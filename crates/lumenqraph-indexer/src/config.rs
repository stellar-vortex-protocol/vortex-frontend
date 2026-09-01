use std::env;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub max_consecutive_errors: u32,
    pub circuit_breaker_interval: Duration,
    pub contract_ids: Vec<String>,
    pub rpc_url: String,
    pub polling_interval: Duration,
    pub max_backoff: Duration,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let max_consecutive_errors = env::var("MAX_CONSECUTIVE_ERRORS")
            .unwrap_or_else(|_| "20".to_string())
            .parse()
            .map_err(ConfigError::InvalidMaxConsecutiveErrors)?;

        let circuit_breaker_interval_secs = env::var("CIRCUIT_BREAKER_INTERVAL_SECS")
            .unwrap_or_else(|_| "300".to_string()) // 5 minutes default
            .parse::<u64>()
            .map_err(ConfigError::InvalidCircuitBreakerInterval)?;

        let contract_ids = env::var("CONTRACT_IDS")
            .map_err(|_| ConfigError::MissingContractIds)?
            .split(',')
            .map(|id| id.trim().to_string())
            .collect::<Vec<_>>();

        // Validate contract IDs using the core validation
        lumenqraph_core::validate_contract_ids(&contract_ids)
            .map_err(|e| ConfigError::InvalidContractId(e))?;

        let rpc_url = env::var("RPC_URL")
            .map_err(|_| ConfigError::MissingRpcUrl)?;

        let polling_interval_secs = env::var("POLLING_INTERVAL_SECS")
            .unwrap_or_else(|_| "5".to_string())
            .parse::<u64>()
            .map_err(ConfigError::InvalidPollingInterval)?;

        let max_backoff_secs = env::var("MAX_BACKOFF_SECS")
            .unwrap_or_else(|_| "60".to_string())
            .parse::<u64>()
            .map_err(ConfigError::InvalidMaxBackoff)?;

        Ok(Config {
            max_consecutive_errors,
            circuit_breaker_interval: Duration::from_secs(circuit_breaker_interval_secs),
            contract_ids,
            rpc_url,
            polling_interval: Duration::from_secs(polling_interval_secs),
            max_backoff: Duration::from_secs(max_backoff_secs),
        })
    }
}



#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Invalid MAX_CONSECUTIVE_ERRORS: {0}")]
    InvalidMaxConsecutiveErrors(#[source] std::num::ParseIntError),
    
    #[error("Invalid CIRCUIT_BREAKER_INTERVAL_SECS: {0}")]
    InvalidCircuitBreakerInterval(#[source] std::num::ParseIntError),
    
    #[error("Missing CONTRACT_IDS environment variable")]
    MissingContractIds,
    
    #[error("Invalid contract ID: {0}")]
    InvalidContractId(String),
    
    #[error("Missing RPC_URL environment variable")]
    MissingRpcUrl,
    
    #[error("Invalid POLLING_INTERVAL_SECS: {0}")]
    InvalidPollingInterval(#[source] std::num::ParseIntError),
    
    #[error("Invalid MAX_BACKOFF_SECS: {0}")]
    InvalidMaxBackoff(#[source] std::num::ParseIntError),
}