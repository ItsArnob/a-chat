export default function (e) {
    if (e.response?.data?.message) {
        if (typeof e.response.data.message === "string") {
            return e.response.data.message;
        } else {
            console.error(e.response.data.message);
            return "Something went wrong, please try again.";
        }
    }
    return `${e.message}`;
}
