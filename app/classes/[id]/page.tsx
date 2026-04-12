"use client";
import { useParams } from "next/navigation";

function ClassInfoPage(){
    const { id } = useParams();
  return (
    <div>
      <h1>{id}</h1>
    </div>
  )
}
export default ClassInfoPage;