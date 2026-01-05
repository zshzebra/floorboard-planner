use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub plank_full_length: f64,
    pub plank_width: f64,
    pub room_height: f64,
    pub saw_kerf: f64,
    pub min_cut_length: f64,
    pub max_unique_cuts: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OptimizationWeights {
    pub cutting_simplicity: f64,
    pub waste_minimization: f64,
    pub visual_randomness: f64,
}
