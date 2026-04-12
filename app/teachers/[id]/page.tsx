"use client";
import { useParams } from "next/navigation";

function TeacherInfoPage(){
    const { id } = useParams();
  return (
    <div>
      <h1>{id}</h1>
    </div>
  )
}
export default TeacherInfoPage;