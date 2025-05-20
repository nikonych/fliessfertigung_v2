export class Maschine {
  constructor(nr, bezeichnung, verfVon, verfBis, kapTag) {
    this.nr = Maschine.formatNumber(nr, 3);
    this.bezeichnung = bezeichnung;
    this.verf_von = Maschine.dateToExcelSerial(verfVon);
    this.verf_bis = Maschine.dateToExcelSerial(verfBis);
    this.kap_tag = parseInt(kapTag) || 0;
  }

  static formatNumber(nr, digits) {
    const num = parseInt(nr);
    return isNaN(num) ? '0'.repeat(digits) : num.toString().padStart(digits, '0');
  }

  static dateToExcelSerial(date) {
    if (!date) return 0;
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(date);
    return Math.floor((jsDate - excelEpoch) / (1000 * 60 * 60 * 24));
  }
}
