/**
 * The one refusal an undo can make, in a file of its own so both halves
 * of the undo — the card's reverses and the board's — can throw it
 * without importing each other. `undo.ts` re-exports it, because that is
 * the door the rest of the product knows.
 */
export class NotUndoable extends Error {
  constructor() {
    super("notUndoable");
    this.name = "NotUndoable";
  }
}
