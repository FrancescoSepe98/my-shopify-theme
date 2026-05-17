/* PET: <pet-size-selector>
 *
 * Informational size/weight selector. Does NOT pilot Shopify variants.
 * Writes a line item property (properties[...]) on the product form via
 * a hidden input linked through the `form` attribute. Disabled when empty
 * so the property is omitted from the order until a value is chosen.
 *
 * Two modes:
 *  - dropdown:     <select> of size labels parsed from the metafield.
 *  - weight_range: <input type="number"> that resolves to a recommended
 *                  size by matching the input against parsed ranges.
 */

if (!customElements.get('pet-size-selector')) {
  class PetSizeSelector extends HTMLElement {
    constructor() {
      super();
      this.mode = this.dataset.mode || 'dropdown';
      this.unit = this.dataset.unit || 'kg';
      this.recommendedTmpl = this.dataset.recommendedTmpl || 'Recommended: {{ size }}';
      this.outOfRangeText = this.dataset.outOfRangeText || '';
      this.hiddenInput = this.querySelector('[data-pet-recommended-size]');

      if (this.mode === 'weight_range') {
        this.weightInput = this.querySelector('[data-pet-weight-input]');
        this.resultEl = this.querySelector('.pet-size-selector__result');
        this.ranges = this.parseRanges();
        if (this.weightInput) {
          this.weightInput.addEventListener('input', this.onWeightChange.bind(this));
        }
      } else {
        this.select = this.querySelector('[data-pet-size-select]');
        if (this.select) {
          this.select.addEventListener('change', this.onSelectChange.bind(this));
        }
      }
    }

    parseRanges() {
      const node = this.querySelector('script[type="application/json"][data-pet-ranges]');
      if (!node) return [];
      let data;
      try {
        data = JSON.parse(node.textContent || '[]');
      } catch (_) {
        return [];
      }
      if (!Array.isArray(data)) return [];
      return data.map((entry) => {
        const label = String(entry.label || '').trim();
        const range = String(entry.range || '').trim();
        let min = 0;
        let max = Infinity;
        if (range.endsWith('+')) {
          const m = parseFloat(range);
          if (!isNaN(m)) min = m;
        } else if (range.includes('-')) {
          const [a, b] = range.split('-').map((v) => parseFloat(v));
          if (!isNaN(a)) min = a;
          if (!isNaN(b)) max = b;
        } else if (range !== '') {
          const m = parseFloat(range);
          if (!isNaN(m)) max = m;
        }
        return { label, range, min, max };
      });
    }

    onSelectChange() {
      this.setProperty(this.select.value);
    }

    onWeightChange() {
      const weight = parseFloat(this.weightInput.value);
      if (isNaN(weight) || weight < 0) {
        this.clearResult();
        return;
      }

      // Treat the final numeric upper bound as inclusive; otherwise half-open.
      const matchIndex = this.ranges.findIndex((r, i) => {
        if (r.max === Infinity) return weight >= r.min;
        const isLast = i === this.ranges.length - 1;
        return weight >= r.min && (isLast ? weight <= r.max : weight < r.max);
      });

      if (matchIndex === -1) {
        if (this.resultEl) {
          this.resultEl.textContent = this.outOfRangeText;
          this.resultEl.dataset.state = 'out-of-range';
        }
        this.setProperty('');
        return;
      }

      const match = this.ranges[matchIndex];
      const rangeText = match.range ? `${match.range} ${this.unit}` : '';
      const display = this.recommendedTmpl.replace('{{ size }}', match.label);

      if (this.resultEl) {
        this.resultEl.textContent = rangeText ? `${display} (${rangeText})` : display;
        delete this.resultEl.dataset.state;
      }

      // Property value: human-readable, includes the entered weight so the
      // merchant has unambiguous context in admin even if the product also
      // has a Shopify "Size" option named differently.
      const propValue = rangeText
        ? `${match.label} (${rangeText}, input: ${weight} ${this.unit})`
        : `${match.label} (input: ${weight} ${this.unit})`;
      this.setProperty(propValue);
    }

    clearResult() {
      if (this.resultEl) {
        this.resultEl.textContent = '';
        delete this.resultEl.dataset.state;
      }
      this.setProperty('');
    }

    setProperty(value) {
      if (!this.hiddenInput) return;
      const v = (value || '').toString().trim();
      if (v) {
        this.hiddenInput.value = v;
        this.hiddenInput.disabled = false;
      } else {
        this.hiddenInput.value = '';
        this.hiddenInput.disabled = true;
      }
    }
  }

  customElements.define('pet-size-selector', PetSizeSelector);
}
