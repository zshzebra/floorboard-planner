use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Layout {
    pub row_offsets: Vec<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct ScoredLayout {
    pub layout: Layout,
    pub total_score: f64,
    pub cutting_score: f64,
    pub waste_score: f64,
    pub randomness_score: f64,
}

impl Layout {
    pub fn random(num_rows: usize, plank_length: f64) -> Self {
        let mut rng = SmallRng::from_entropy();
        let row_offsets: Vec<f64> = (0..num_rows)
            .map(|_| -rng.gen::<f64>() * plank_length)
            .collect();

        Layout { row_offsets }
    }

    pub fn mutate(&self, plank_length: f64, mutation_strength: f64) -> Self {
        if self.row_offsets.is_empty() {
            return self.clone();
        }

        let mut rng = SmallRng::from_entropy();
        let mut new_offsets = self.row_offsets.clone();

        let idx = rng.gen_range(0..new_offsets.len());
        let delta = (rng.gen::<f64>() - 0.5) * plank_length * mutation_strength;
        new_offsets[idx] = (new_offsets[idx] + delta).clamp(-plank_length, 0.0);

        Layout {
            row_offsets: new_offsets,
        }
    }
}
