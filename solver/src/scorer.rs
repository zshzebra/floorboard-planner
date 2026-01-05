use crate::config::{Config, OptimizationWeights};
use crate::layout::{Layout, ScoredLayout};
use std::collections::HashSet;

struct CutRequirement {
    length: f64,
}

struct AllocationResult {
    waste: f64,
    total_material: f64,
    offcuts_reused: usize,
    offcuts_wasted: usize,
    unique_cuts: usize,
}

pub fn score(config: &Config, weights: &OptimizationWeights, layout: &Layout) -> ScoredLayout {
    let allocation = allocate_material(config, layout);

    let waste_score = if allocation.total_material > 0.0 {
        allocation.total_material / (allocation.total_material + allocation.waste)
    } else {
        0.5
    };

    let total_offcuts = allocation.offcuts_reused + allocation.offcuts_wasted;
    let reuse_score = if total_offcuts > 0 {
        (allocation.offcuts_reused as f64 + 1.0) / (total_offcuts as f64 + 1.0)
    } else {
        0.5
    };

    let randomness_score = score_randomness(config, layout);

    let total_weight =
        weights.cutting_simplicity + weights.waste_minimization + weights.visual_randomness;
    let mut total_score = if total_weight > 0.0 {
        (weights.cutting_simplicity * reuse_score
            + weights.waste_minimization * waste_score
            + weights.visual_randomness * randomness_score)
            / total_weight
    } else {
        0.0
    };

    if let Some(max) = config.max_unique_cuts {
        if allocation.unique_cuts > max as usize {
            total_score *= 0.01;
        }
    }

    ScoredLayout {
        layout: layout.clone(),
        total_score,
        cutting_score: reuse_score,
        waste_score,
        randomness_score,
    }
}

fn allocate_material(config: &Config, layout: &Layout) -> AllocationResult {
    let requirements = calculate_requirements(config, layout);

    let unique_lengths: HashSet<i64> = requirements
        .iter()
        .filter(|r| (r.length - config.plank_full_length).abs() > 0.1)
        .map(|r| (r.length * 10.0) as i64)
        .collect();
    let unique_cuts = unique_lengths.len();

    let mut sorted_reqs: Vec<_> = requirements.iter().collect();
    sorted_reqs.sort_by(|a, b| b.length.partial_cmp(&a.length).unwrap());

    let mut waste = 0.0;
    let mut total_material = 0.0;
    let mut offcuts_reused = 0usize;
    let mut offcuts_wasted = 0usize;

    let mut available_offcuts: Vec<f64> = Vec::new();

    for req in sorted_reqs {
        if (req.length - config.plank_full_length).abs() < 0.1 {
            total_material += config.plank_full_length;
            continue;
        }

        let usable_idx = available_offcuts
            .iter()
            .position(|&o| o >= req.length + config.saw_kerf);

        if let Some(idx) = usable_idx {
            let offcut_length = available_offcuts.remove(idx);
            offcuts_reused += 1;

            let remaining = offcut_length - req.length - config.saw_kerf;
            if remaining >= config.min_cut_length {
                available_offcuts.push(remaining);
            } else if remaining > 0.0 {
                waste += remaining;
            }
            waste += config.saw_kerf;
        } else {
            total_material += config.plank_full_length;

            let offcut_length = config.plank_full_length - req.length - config.saw_kerf;
            if offcut_length >= config.min_cut_length {
                available_offcuts.push(offcut_length);
            } else if offcut_length > 0.0 {
                waste += offcut_length;
            }
            waste += config.saw_kerf;
        }
    }

    for offcut in &available_offcuts {
        waste += offcut;
        offcuts_wasted += 1;
    }

    AllocationResult {
        waste,
        total_material,
        offcuts_reused,
        offcuts_wasted,
        unique_cuts,
    }
}

fn calculate_requirements(config: &Config, layout: &Layout) -> Vec<CutRequirement> {
    let mut requirements = Vec::new();

    for &offset in &layout.row_offsets {
        let mut current_y = offset;
        let num_boards = (config.room_height / config.plank_full_length).ceil() as usize + 1;

        for _ in 0..num_boards {
            let board_start = current_y;
            let board_end = current_y + config.plank_full_length;

            let visible_start = board_start.max(0.0);
            let visible_end = board_end.min(config.room_height);

            if visible_end > visible_start {
                let visible_length = visible_end - visible_start;
                requirements.push(CutRequirement {
                    length: visible_length,
                });
            }

            current_y += config.plank_full_length;
        }
    }

    requirements
}

fn score_randomness(config: &Config, layout: &Layout) -> f64 {
    let offsets = &layout.row_offsets;
    if offsets.len() < 2 {
        return 0.5;
    }

    let normalized: Vec<f64> = offsets
        .iter()
        .map(|&o| o / config.plank_full_length)
        .collect();

    let mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
    let variance =
        normalized.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / normalized.len() as f64;
    let std_dev = variance.sqrt();

    std_dev * 4.0
}
