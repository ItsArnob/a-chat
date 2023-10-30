use once_cell::sync::Lazy;
use regex::Regex;

// Internal defaults.
pub const API_DEFAULT_HOST: &str = "127.0.0.1";
pub const API_DEFAULT_PORT: &str = "5000";

// logging events
pub const EVENT_SYS_CRASH: &str = "sys_crash";
pub const EVENT_SYS_INTERNAL_ERROR: &str = "sys_internal_error";

// other
pub static USERNAME_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[a-zA-Z_0-9\-]*$").unwrap());
