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
    return null;
}

let username = decodeURI(getIRIParameterValue("username"));
if (
    typeof username == "undefined" ||
    username === null ||
    username === "null" ||
    username === ""
) {
    username = "Anonymous_" + Math.floor(Math.random() * 1000);
}

// $('#messages').prepend('<b>' + username + ':</b>');

let chatRoom = decodeURI(getIRIParameterValue("game_id"));

if (
    typeof chatRoom == "undefined" ||
    chatRoom === null ||
    chatRoom === "null"
) {
    chatRoom = "Lobby";
}
/** Set up the socket.io connection to the server */

let socket = io();
socket.on("log", (array) => {
    console.log.apply(console, array);
});

function makeInviteButton(socketId) {
    let newHTML =
        '<button type="button" class="btn btn-outline-primary">Invite</button>';
    let newNode = $(newHTML);

    /**
     * newNode.click(
     *      let response = {
     *          required_user:socketId,
     * })
     */

    newNode.on("click", () => {
        let response = {
            requested_user: socketId,
        };
        console.log(
            "**** client log message, sending 'invite' command" +
            JSON.stringify(response)
        );
        socket.emit("invite", response);
    });
    return newNode;
}

function makeInvitedButton(socketId) {
    let newHTML =
        '<button type="button" class="btn btn-primary">Invited</button>';
    let newNode = $(newHTML);

    newNode.on("click", () => {
        let response = {
            requested_user: socketId,
        };
        console.log(
            "**** client log message, sending 'uninvite' command" +
            JSON.stringify(response)
        );
        socket.emit("uninvite", response);
    });
    return newNode;
}

function makePlayButton(socketId) {
    let newHTML = '<button type="button" class="btn btn-success">Play</button>';
    let newNode = $(newHTML);

    newNode.on("click", () => {
        let response = {
            requested_user: socketId,
        };
        console.log(
            "**** client log message, sending 'game_start' command" +
            JSON.stringify(response)
        );
        socket.emit("game_start", response);
    });

    return newNode;
}

function makeStartGameButton() {
    let newHTML =
        '<button type="button" class="btn btn-danger">Starting Game</button>';
    let newNode = $(newHTML);
    return newNode;
}

// response to the invite button being clicked
socket.on("invite_response", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    let newNode = makeInvitedButton(response.socketId);
    $(".socket_" + response.socketId + " button").replaceWith(newNode);
    /** We know we got a good response */
});

socket.on("invited", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    let newNode = makePlayButton(response.socketId);
    $(".socket_" + response.socketId + " button").replaceWith(newNode);
    /** We know we got a good response */
});

socket.on("uninvited", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    let newNode = makeInviteButton(response.socketId);
    $(".socket_" + response.socketId + " button").replaceWith(newNode);
    /** We know we got a good response */
});

socket.on("game_start_response", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    let newNode = makeStartGameButton();
    $(".socket_" + response.socketId + " button").replaceWith(newNode);

    /** Jump to the game page */
    window.location.href = 'game.html?username=' + username + '&game_id' + response.gameId;
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

    /** We don't want to be notified of ourselves */
    if (response.socketId === socket.id) {
        return;
    }

    let domElements = $(".socket_" + response.socketId);

    if (domElements.length !== 0) {
        return;
    }

    let nodeA = $("<div></div>");
    nodeA.addClass("row");
    nodeA.addClass("align-text-center");
    nodeA.addClass("socket_" + response.socketId);
    nodeA.hide();

    let nodeB = $("<div></div>");
    nodeB.addClass("col");
    nodeB.addClass("text-end");
    nodeB.addClass("socket_" + response.socketId);
    nodeB.append("<h4>" + response.username + "</h4>");

    let nodeC = $("<div></div>");
    nodeC.addClass("col");
    nodeC.addClass("text-end");
    nodeC.addClass("socket_" + response.socketId);

    let buttonC = makeInviteButton(response.socketId);
    nodeC.append(buttonC);

    nodeA.append(nodeB);
    nodeA.append(nodeC);

    $("#players").append(nodeA);
    nodeA.fadeIn(500);

    /** Announcing when someone arrives */
    let newString =
        '<p class="join_room_response">' +
        response.username +
        " joined the " +
        response.room +
        ". (There are " +
        response.count +
        " users in this room)</p>";
    let newNode = $(newString);
    newNode.hide();
    $("#messages").prepend(newString);
    newNode.fadeIn(500);
});

socket.on("player_disconnected", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }

    if (response.socketId === socket.id) {
        return;
    }

    let domElements = $(".socket_" + response.socketId);
    if (domElements.length !== 0) {
        domElements.hide(500);
    }

    /** We know we got a good response */

    let newString =
        '<p class="left_room_response">' +
        response.username +
        " left the " +
        response.room +
        ". (There are " +
        response.count +
        " users in this room)</p>";
    let newNode = $(newString);
    newNode.hide();
    $("#messages").prepend(newNode);
    newNode.fadeIn(1000);
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
    $("#chat-message").val("");
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

    let newHTML =
        "<p class='chat_message'><b>" +
        response.username +
        "</b>: " +
        response.message +
        "</p>";
    let newNode = $(newHTML);
    newNode.hide();
    $("#messages").prepend(newNode);
    newNode.fadeIn(500);
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

    $("#lobby-title").html(username + "'s Lobby");

    $("#chat-message").keypress(function(e) {
        let key = e.which;
        if (key === 13) {
            $("button[id = chat-button]").click();
            return false;
        }
    });
});