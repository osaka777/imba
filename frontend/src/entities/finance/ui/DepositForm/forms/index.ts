import React from "react";
import { AaioForm } from "./AaioForm";
import { BovaForm } from "./BovaForm";
import { CrocoPayForm } from "./CrocoPayForm";
import { NirvanaPayForm } from "./NirvanaPayForm";
// import { GreengoForm } from "./GreengoForm";

export const forms: { [key: string]: React.ComponentType<any> } = {
  AaioForm,
  BovaForm,
  CrocoPayForm,
  NirvanaPayForm,
  // GreengoForm,
};
