import { deleteSession } from "../lib/deleteSession";

export const exit = async () => {
    await deleteSession();
};
