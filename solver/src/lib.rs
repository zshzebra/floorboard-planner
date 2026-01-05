mod config;
mod layout;
mod optimizer;
mod scorer;

use config::{Config, OptimizationWeights};
use layout::Layout;
use rayon::prelude::*;
use wasm_bindgen::prelude::*;

pub use wasm_bindgen_rayon::init_thread_pool;

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

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

        // Log the weights for debugging
        web_sys::console::log_1(
            &format!(
                "Creating solver with weights: cutting={}, waste={}, randomness={}",
                weights.cutting_simplicity, weights.waste_minimization, weights.visual_randomness
            )
            .into(),
        );

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

    pub fn generate_and_score(&self) -> JsValue {
        let layout = Layout::random(self.num_rows, self.config.plank_full_length);
        let scored = scorer::score(&self.config, &self.weights, &layout);
        serde_wasm_bindgen::to_value(&scored).unwrap()
    }

    pub fn generate_batch_best(&self, batch_size: usize) -> JsValue {
        let best = (0..batch_size)
            .into_par_iter()
            .map(|_| {
                let layout = Layout::random(self.num_rows, self.config.plank_full_length);
                scorer::score(&self.config, &self.weights, &layout)
            })
            .max_by(|a, b| match a.total_score.partial_cmp(&b.total_score) {
                Some(ord) => ord,
                None => {
                    web_sys::console::error_1(
                        &format!(
                            "NaN detected in scores: a={}, b={}",
                            a.total_score, b.total_score
                        )
                        .into(),
                    );
                    std::cmp::Ordering::Equal
                }
            })
            .unwrap();

        serde_wasm_bindgen::to_value(&best).unwrap()
    }
}
