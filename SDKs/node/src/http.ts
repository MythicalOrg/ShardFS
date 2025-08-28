import axios from "axios";

export const makeMasterClient = (masterUrl: string, timeoutMs = 60000) =>
  axios.create({
    baseURL: masterUrl.replace(/\/+$/, ""), // trim trailing slash
    timeout: timeoutMs
  });
