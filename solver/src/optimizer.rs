use crate::config::{Config, OptimizationWeights};
use crate::layout::Layout;
use crate::scorer;
use rand::Rng;

pub fn optimize(
    config: &Config,
    weights: &OptimizationWeights,
    initial: &Layout,
    max_iterations: u32,
) -> Layout {
    let mut rng = rand::thread_rng();
    let mut current = initial.clone();
    let mut best = initial.clone();
    let mut current_score = scorer::score(config, weights, &current).total_score;
    let mut best_score = current_score;

    let mut temperature = 1.0;
    let cooling_rate = 0.995;

    for iteration in 0..max_iterations {
        let progress = iteration as f64 / max_iterations as f64;
        let mutation_strength = 0.5 * (1.0 - progress) + 0.05;

        let neighbor = current.mutate(config.plank_full_length, mutation_strength);
        let neighbor_score = scorer::score(config, weights, &neighbor).total_score;

        let delta = neighbor_score - current_score;

        if delta > 0.0 || rng.gen::<f64>() < (delta / temperature).exp() {
            current = neighbor;
            current_score = neighbor_score;

            if current_score > best_score {
                best = current.clone();
                best_score = current_score;
            }
        }

        temperature *= cooling_rate;
    }

    best
}
