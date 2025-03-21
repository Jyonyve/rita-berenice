import axios from 'axios';

const baseURL = process.env.VITE_CHROMA_API_URL;

export const axiosCharacter = axios.create({ baseURL: `${baseURL}/character` });

export const axiosDocument = axios.create({ baseURL: `${baseURL}/document` });

// Add more Axios instances as needed
