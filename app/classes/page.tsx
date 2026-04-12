"use client";
import { supabase } from "@/supabase";
import { useCallback, useEffect, useState } from "react";
interface Class {
    id: number;
    teacher: string;
}

function ClassesPage(){
    const [ classes, setClasses ] = useState<Class[]>([]);
    const fetchClasses = useCallback(async () => {
        const { data, error } = await supabase.from("classes").select("*");
        if (error) {
            console.error(error);
        } else {
            setClasses(data as Class[]);
        }
    }, []);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

  return (
    <div>
      <h1>Classes Page</h1>
      {classes && classes.map((cls) => (
        <div key={cls.id}>
          <h2>{cls.teacher}</h2>
        </div>
      ))}
    </div>
  )
}
export default ClassesPage;