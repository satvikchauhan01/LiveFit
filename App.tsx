import HomeScreen from "./src/screens/HomeScreen";
import { useState } from "react";
import FitnessScreen from "./src/screens/FitnessScreen";


export default function App(){
  const [CurrentScreen, setCurrentScreen]= useState<"home" | "fitness">("home");

  if(CurrentScreen ==="home"){
    return <HomeScreen />;
  }
  return <FitnessScreen />;
}