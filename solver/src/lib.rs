mod config;
mod layout;
mod optimizer;
mod scorer;

use config::{Config, OptimizationWeights};
use layout::Layout;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Solver {
    config: Config,
    weights: OptimizationWeights,
    num_rows: usize,
}

#[wasm_bindgen]
impl Solver {
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue, weights: JsValue, num_rows: usize) -> Result<Solver, JsValue> {
        let config: Config = serde_wasm_bindgen::from_value(config)?;
        let weights: OptimizationWeights = serde_wasm_bindgen::from_value(weights)?;

        Ok(Solver {
            config,
            weights,
            num_rows,
        })
    }

    pub fn generate_random(&self) -> JsValue {
        let layout = Layout::random(self.num_rows, self.config.plank_full_length);
        serde_wasm_bindgen::to_value(&layout).unwrap()
    }

    pub fn optimize(&self, initial_layout: JsValue, max_iterations: u32) -> JsValue {
        let layout: Layout = serde_wasm_bindgen::from_value(initial_layout).unwrap();
        let optimized = optimizer::optimize(&self.config, &self.weights, &layout, max_iterations);
        serde_wasm_bindgen::to_value(&optimized).unwrap()
    }

    pub fn score_layout(&self, layout: JsValue) -> JsValue {
        let layout: Layout = serde_wasm_bindgen::from_value(layout).unwrap();
        let scored = scorer::score(&self.config, &self.weights, &layout);
        serde_wasm_bindgen::to_value(&scored).unwrap()
    }
}
