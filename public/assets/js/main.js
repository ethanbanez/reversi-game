function getIRIParameterValue(requestedKey) {
    let pageIRI = window.location.search.substring(1);
    let pageIRIVariables = pageIRI.split("&");
    for (let i = 0; i < pageIRIVariables.length; i++) {
        let data = pageIRIVariables[i].split("=");
        let key = data[0];
        let value = data[1];
        if (key === requestedKey) {
            return value;
        }
    }
}

let username = decodeURI(getIRIParameterValue("username"));
if (typeof username == "undefined" || username === null) {
    username = "Anonymous_" + Math.floor(Math.random() * 1000);
}

// $('#messages').prepend('<b>' + username + ':</b>');

let chatRoom = "Lobby";

/** Set up the socket.io connection to the server */

let socket = io();
socket.on("log", (array) => {
    console.log.apply(console, array);
});

socket.on("join_room_response", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    /** We know we got a good response */

    let newString =
        '<p class="join_room_response">' +
        response.username +
        " joined the " +
        response.room +
        ". (There are " +
        response.count +
        " users in this room)</p>";
    $("#messages").prepend(newString);
});

function sendChatMessage() {
    let request = {};
    request.room = chatRoom;
    request.username = username;
    request.message = $("#chat-message").val();

    console.log(
        "**** client log message, sending 'send_chat_message' command" +
        JSON.stringify(request)
    );
    socket.emit("send_chat_message", request);
}

socket.on("send_chat_message_response", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    /** We know we got a good response */

    let newString =
        "<p class='chat_message'><b>" +
        response.username +
        "</b>: " +
        response.message +
        "</p>";
    $("#messages").prepend(newString);
});

/** Request to join the chatroom */
$(() => {
    let request = {};
    request.room = chatRoom;
    request.username = username;
    console.log(
        "**** client log message, sending 'join room' command" +
        JSON.stringify(request)
    );
    socket.emit("join_room", request);
});