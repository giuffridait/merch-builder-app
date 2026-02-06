const inventory = require('../data/inventory.acp.json');

function toKey(color, material) {
  return `${color}|${material}`.toLowerCase().replace(/\s+/g, '-');
}

function validateInventory() {
  const errors = [];
  const warnings = [];

  for (const item of inventory) {
    if (!item.item_id) errors.push(`Missing item_id for item: ${JSON.stringify(item).slice(0, 80)}...`);
    if (!item.attributes?.category) errors.push(`Missing category for ${item.item_id}`);
    if (!Array.isArray(item.attributes?.materials) || item.attributes.materials.length === 0) {
      errors.push(`Missing materials for ${item.item_id}`);
    }
    if (!Array.isArray(item.attributes?.variants?.colors) || item.attributes.variants.colors.length === 0) {
      errors.push(`Missing colors for ${item.item_id}`);
    }
    if (!Array.isArray(item.attributes?.variants?.sizes)) {
      errors.push(`Missing sizes array for ${item.item_id}`);
    }

    const colors = item.attributes?.variants?.colors || [];
    const materials = item.attributes?.materials || [];
    const imageMap = item.image_url_by_variant || {};
    const availabilityMap = item.availability_by_variant || {};

    if (item.image_url_by_variant) {
      for (const color of colors) {
        for (const material of materials) {
          const key = toKey(color.name, material);
          if (!imageMap[key]) {
            errors.push(`Missing image_url_by_variant for ${item.item_id} (${key})`);
          }
        }
      }
    } else {
      warnings.push(`No image_url_by_variant for ${item.item_id} (uses base image)`);
    }

    if (item.availability_by_variant) {
      for (const key of Object.keys(availabilityMap)) {
        if (!imageMap[key]) {
          warnings.push(`availability_by_variant key without image_url_by_variant: ${item.item_id} (${key})`);
        }
      }
    }
  }

  return { errors, warnings };
}

function filterInventory(items, constraints) {
  return items.filter(item => {
    if (!item.is_eligible_search) return false;
    if (item.availability !== 'in stock') return false;
    if (constraints.category && item.attributes.category !== constraints.category) return false;
    if (constraints.budgetMax != null && item.price.amount > constraints.budgetMax) return false;
    if (constraints.materials && constraints.materials.length > 0) {
      const hasAny = constraints.materials.some(m => item.attributes.materials.includes(m));
      if (!hasAny) return false;
    }
    if (constraints.color) {
      const hasColor = item.attributes.variants.colors.some(c => c.name.toLowerCase() === constraints.color);
      if (!hasColor) return false;
    }
    if (constraints.size) {
      const sizes = item.attributes.variants.sizes || [];
      if (sizes.length === 0) return false;
      if (!sizes.includes(constraints.size)) return false;
    }
    if (constraints.leadTimeMax != null && item.attributes.lead_time_days > constraints.leadTimeMax) {
      return false;
    }
    return true;
  });
}

function validateConstraintsCoverage() {
  const errors = [];
  for (const item of inventory) {
    const colors = item.attributes.variants.colors;
    const materials = item.attributes.materials;
    const sizes = item.attributes.variants.sizes;
    const sampleColor = colors[0]?.name?.toLowerCase();
    const sampleMaterial = materials[0];
    const sampleSize = sizes.length > 0 ? sizes[0] : null;
    const constraints = {
      category: item.attributes.category,
      budgetMax: item.price.amount,
      materials: sampleMaterial ? [sampleMaterial] : undefined,
      color: sampleColor,
      size: sampleSize || undefined,
      leadTimeMax: item.attributes.lead_time_days
    };
    const matches = filterInventory(inventory, constraints);
    if (!matches.find(m => m.item_id === item.item_id)) {
      errors.push(`Constraint match failed for ${item.item_id}`);
    }
  }
  return errors;
}

const { errors, warnings } = validateInventory();
const constraintErrors = validateConstraintsCoverage();

if (warnings.length > 0) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.warn(`- ${w}`);
}

if (errors.length > 0 || constraintErrors.length > 0) {
  console.error(`Errors (${errors.length + constraintErrors.length}):`);
  for (const e of errors) console.error(`- ${e}`);
  for (const e of constraintErrors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('Inventory validation passed.');
