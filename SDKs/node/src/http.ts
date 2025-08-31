import axios from "axios";

//axios is extra dependency here, maybe in future we can use native fetch

export const makeMasterClient = (masterUrl: string, timeoutMs = 60000) =>
  axios.create({
    baseURL: masterUrl.replace(/\/+$/, ""), // trim trailing slash
    timeout: timeoutMs
  });


