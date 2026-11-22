import { createContext, useContext } from "react";

export interface Nav {
  openExercise: (id: string) => void;
  back: () => void;
  /** Abre a troca de acordes com estes acordes. */
  openChordTrainer: (chords: string[]) => void;
}
export const NavContext = createContext<Nav>({ openExercise: () => {}, back: () => {}, openChordTrainer: () => {} });
export const useNav = () => useContext(NavContext);
