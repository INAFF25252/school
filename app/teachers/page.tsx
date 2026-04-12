"use client";
import { supabase } from "@/supabase";
import { useCallback, useEffect, useState } from "react";
interface Teacher {
    id: number;
    name: string;
    email: string;
}

function TeachersPage(){
    const [ teachers, setTeachers ] = useState<Teacher[]>([]);
    const fetchTeachers = useCallback(async () => {
        const { data, error } = await supabase.from("teachers").select("*");
        if (error) {
            console.error(error);
        } else {
            setTeachers(data as Teacher[]);
        }
    }, []);

    useEffect(() => {
        fetchTeachers();
    }, [fetchTeachers]);


  return (
    <div>
      <h1>Teachers Page</h1>
      {teachers && teachers.map((teacher) => (
        <div key={teacher.id}>
          <h2>Name: {teacher.name}; Email: {teacher.email}</h2>
        </div>
      ))}
    </div>
  )
}
export default TeachersPage;