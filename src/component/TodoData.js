import React, {  useEffect, useState } from "react";
import Axios from "axios";


const ShowTodos = () => {
  //Begin Here
  const [todos, setTodos] = useState([]);
  
  useEffect( () => { 
      async function fetchData() {
          try {
              const res = await Axios.get('http://localhost:8080/items'); 
              setTodos(JSON.stringify(res.data));
              console.log(JSON.stringify(res.data));
          } catch (err) {
              console.log(err);
          }
      }
      fetchData();
  }, []);
  return <div>{todos}</div>
}
export default ShowTodos;
