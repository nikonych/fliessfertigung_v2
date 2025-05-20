export class Auftrag {
  constructor(auftragNr, anzahl, start) {
    this.auftrag_nr = auftragNr.toString();
    this.anzahl = parseInt(anzahl) || 0;
    this.start = parseInt(start) || 0;
  }
}
