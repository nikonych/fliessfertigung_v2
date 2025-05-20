export class Arbeitsplan {
  constructor(auftragNr, agNr, maschine, dauer) {
    this.auftrag_nr = auftragNr.toString();
    this.ag_nr = Arbeitsplan.formatNumber(agNr, 2);
    this.maschine = Arbeitsplan.formatNumber(maschine, 3);
    this.dauer = parseInt(dauer) || 0;
  }

  static formatNumber(nr, digits) {
    const num = parseInt(nr);
    return isNaN(num) ? '0'.repeat(digits) : num.toString().padStart(digits, '0');
  }
}
