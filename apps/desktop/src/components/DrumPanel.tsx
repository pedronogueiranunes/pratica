import { useSequenceDraft } from "../lib/sequence-draft";
import { ChordSequence } from "../screens/ChordSequence";
/** Mesmo transporte e mixer, com acordes desligados nesta área de prática. */
export function DrumPanel() {
  const { draft, setDraft, error } = useSequenceDraft();
  return <div className="drum-panel">{error && <p role="alert" className="error">{error}</p>}<ChordSequence standalone draft={draft} setDraft={setDraft} onChoose={() => {}} /></div>;
}
