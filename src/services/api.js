import axios from "axios";

const baseUrl = "http://localhost:8080";

export const authenticate = async (username, password) => {
    try {
        await axios.get(`${baseUrl}/authenticate`, {
            auth: { username, password },
            withCredentials: true
        });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
};

export const createUser = async (username, password) => {
    try {
        const options = {
            auth: {
                username: username,
                password: password
            }
        }
        return await axios.post(`${baseUrl}/users`, {}, options);
    } catch (e) {
        console.log(e);
    }
}

Axios({
    method: "POST",
    url: "http://localhost:8080/item",
    data: {jsonObject},
    headers: {
      "Content-Type": "application/json"
    },
    withCredentials: true
  }).then(res => {
    console.log(res.data.message);
  });