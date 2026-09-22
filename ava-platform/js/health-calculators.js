/* OWNED_BY: ava. Local educational estimates. No storage, network, diagnosis, or product recommendation. */
(function (root) {
  'use strict';
  function numberInRange(value, min, max, label, integer) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} harus antara ${min} dan ${max}.`);
    if (integer && !Number.isInteger(value)) throw new Error(`${label} diisi dalam angka bulat.`);
    return value;
  }
  function calculateBMI({weight, height}) {
    numberInRange(weight, 20, 350, 'Berat badan'); numberInRange(height, 120, 230, 'Tinggi badan');
    const metres=height/100, bmi=weight/(metres**2);
    const category=bmi<18.5?'Berat badan kurang':bmi<25?'Rentang berat badan sehat':bmi<30?'Berat badan berlebih':'Kategori obesitas';
    return {bmi,category,healthyMin:18.5*metres**2,healthyMax:24.9*metres**2};
  }
  function calculateEnergy({age, weight, height, sex, factor}) {
    numberInRange(age,20,78,'Usia',true); numberInRange(weight,20,350,'Berat badan'); numberInRange(height,120,230,'Tinggi badan');
    if(!['male','female'].includes(sex)) throw new Error('Pilih parameter jenis kelamin rumus.');
    if(![1.2,1.4,1.6,1.8].includes(factor)) throw new Error('Pilih skenario aktivitas yang tersedia.');
    const resting=10*weight+6.25*height-5*age+(sex==='male'?5:-161);
    if(resting<=0) throw new Error('Kombinasi input berada di luar hasil yang dapat digunakan.');
    return {resting,maintenance:resting*factor};
  }
  function calculateWater({weight}) {
    numberInRange(weight,20,250,'Berat badan'); return {minimum:weight*30/1000,maximum:weight*35/1000};
  }
  function calculateMacros({calories}) {
    numberInRange(calories,800,6000,'Energi harian');
    return {carbohydrate:[calories*.45/4,calories*.65/4],protein:[calories*.10/4,calories*.35/4],fat:[calories*.20/9,calories*.35/9]};
  }
  function calculate({age,weight,height,sex,factor,eligible}) {
    if(eligible!==true) throw new Error('Kalkulator gabungan hanya untuk penggunaan edukasi dewasa yang sesuai dengan batasannya.');
    return {...calculateBMI({weight,height}),...calculateEnergy({age,weight,height,sex,factor})};
  }
  const api={calculate,calculateBMI,calculateEnergy,calculateWater,calculateMacros};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(!root.document) return;
  const format=(value,digits=0)=>value.toLocaleString('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const values=form=>Object.fromEntries(new FormData(form));
  function connect(formId,resultId,compute,render) {
    const form=root.document.getElementById(formId),result=root.document.getElementById(resultId);
    if(!form||!result) return;
    const message=form.querySelector('.tool-message'),submit=form.querySelector('button[type="submit"]');
    if(submit) submit.disabled=false;
    const clear=()=>{result.hidden=true;if(message)message.textContent='';};
    form.addEventListener('input',clear); form.addEventListener('reset',clear);
    form.addEventListener('submit',event=>{event.preventDefault();clear();try{const output=compute(values(form));render(output);result.hidden=false;if(message)message.textContent='Perhitungan selesai. Baca konteks dan batasan sebelum menggunakan hasil.';}catch(error){if(message)message.textContent=error.message;}});
  }
  connect('bmi-tool','bmi-result',data=>calculateBMI({weight:Number(data.weight),height:Number(data.height)}),output=>{
    root.document.getElementById('bmi-value').textContent=format(output.bmi,2);
    root.document.getElementById('bmi-category').textContent=output.category;
    root.document.getElementById('healthy-weight-value').textContent=`${format(output.healthyMin,1)}–${format(output.healthyMax,1)} kg`;
  });
  connect('energy-tool','energy-result',data=>calculateEnergy({age:Number(data.age),weight:Number(data.weight),height:Number(data.height),sex:data.sex,factor:Number(data.factor)}),output=>{
    root.document.getElementById('resting-value').textContent=format(output.resting);
    root.document.getElementById('energy-value').textContent=format(output.maintenance);
    const macroInput=root.document.getElementById('macro-calories'); if(macroInput&&!macroInput.value) macroInput.value=String(Math.round(output.maintenance));
  });
  connect('water-tool','water-result',data=>calculateWater({weight:Number(data.weight)}),output=>{
    root.document.getElementById('water-value').textContent=`${format(output.minimum,1)}–${format(output.maximum,1)}`;
  });
  connect('macro-tool','macro-result',data=>calculateMacros({calories:Number(data.calories)}),output=>{
    const range=pair=>`${format(pair[0])}–${format(pair[1])} g/hari`;
    root.document.getElementById('carb-value').textContent=range(output.carbohydrate);
    root.document.getElementById('protein-value').textContent=range(output.protein);
    root.document.getElementById('fat-value').textContent=range(output.fat);
  });
})(typeof window!=='undefined'?window:globalThis);
