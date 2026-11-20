import { createContext, useContext } from "react";

export interface Nav {
  openExercise: (id: string) => void;
  back: () => void;
}
export const NavContext = createContext<Nav>({ openExercise: () => {}, back: () => {} });
export const useNav = () => useContext(NavContext);
