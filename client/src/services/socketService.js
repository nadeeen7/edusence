import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/api";

const SOCKET_URL = API_BASE_URL;

const socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
});

export default socket;
