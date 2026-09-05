/* OWNED_BY: ava. Local educational estimates. No storage, network, or diet targets. */
(function (root) {
  'use strict';
  function calculate({ age, weight, height, sex, factor, eligible }) {
    if (eligible !== true) throw new Error('Kalkulator hanya untuk orang dewasa yang tidak sedang hamil atau menyusui dan tidak memerlukan pengaturan gizi medis.');
    for (const [value, min, max, label] of [[age,20,78,'Usia'],[weight,20,350,'Berat badan'],[height,120,230,'Tinggi badan']]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} harus antara ${min} dan ${max}.`);
    }
    if (!Number.isInteger(age)) throw new Error('Usia diisi dalam tahun penuh.');
    if (!['male','female'].includes(sex) || ![1.2,1.4,1.6,1.8].includes(factor)) throw new Error('Pilih parameter rumus dan skenario aktivitas yang tersedia.');
    const bmi = weight / ((height / 100) ** 2);
    const category = bmi < 18.5 ? 'Berat badan kurang' : bmi < 25 ? 'Rentang berat badan sehat' : bmi < 30 ? 'Berat badan berlebih' : 'Kategori obesitas';
    const resting = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
    if (resting <= 0) throw new Error('Kombinasi input berada di luar hasil yang dapat digunakan. Konsultasikan dengan tenaga kesehatan.');
    return { bmi, category, resting, maintenance: resting * factor };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculate };
  if (!root.document) return;
  const form = root.document.querySelector('#health-calculator');
  if (!form) return;
  const result = root.document.querySelector('#calculator-result');
  const message = root.document.querySelector('#calculator-message');
  const clear = () => { result.hidden = true; message.textContent = ''; };
  form.addEventListener('input', clear);
  form.addEventListener('reset', clear);
  form.addEventListener('submit', event => {
    event.preventDefault(); clear();
    try {
      const data = new FormData(form);
      const value = calculate({ age:Number(data.get('age')), weight:Number(data.get('weight')), height:Number(data.get('height')), sex:data.get('sex'), factor:Number(data.get('factor')), eligible:data.get('eligible') === 'on' });
      const format = (n,d=0) => n.toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d});
      root.document.querySelector('#bmi-value').textContent = format(value.bmi,2);
      root.document.querySelector('#bmi-category').textContent = value.category;
      root.document.querySelector('#resting-value').textContent = format(value.resting);
      root.document.querySelector('#energy-value').textContent = format(value.maintenance);
      result.hidden = false;
      message.textContent = 'Perhitungan selesai. Hasil merupakan estimasi edukasi, bukan diagnosis atau target diet.';
    } catch (error) { message.textContent = error.message; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
