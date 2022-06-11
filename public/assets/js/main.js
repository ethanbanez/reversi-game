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

let chatRoom = decodeURI(getIRIParameterValue("gameId"));

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
    window.location.href =
        "game.html?username=" + username + "&gameId=" + response.gameId;
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
        " left the chatroom. (There are " +
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

let oldBoard = [
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
    [" ", " ", " ", " ", " ", " ", " ", " "],
];

let myColor = "";
let intervalTimer;

socket.on("game_update", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    let board = response.game.board;
    if (typeof board == "undefined" || board === null) {
        console.log("Server did not send a valid board to display");
        return;
    }

    /** Update client color */
    if (socket.id === response.game.playerWhite.socket) {
        myColor = "white";
    } else if (socket.id === response.game.playerBlack.socket) {
        myColor = "black";
    } else {
        window.location.href = "lobby.html?username=" + username;
        console.log(
            "player: " +
            response.game.playerBlack.socket +
            "was not assigned a color"
        );
        return;
    }

    $("#my-color").html('<h3 id="my-color">I am ' + myColor + "</h3>");
    if (myColor === "white") {
        $("#my-color").html("<h3 id='my-color'>I am white</h3>");
    } else if (myColor === "black") {
        $("#my-color").html("<h3 id='my-color'>I am black</h3>");
    } else {
        $("#my-color").html(
            "<h3 id='my-color'>I don't know what color I am</h3>"
        );
    }

    if (response.game.whoseTurn === "white") {
        $("#my-color").append("<h4>It is white's turn</h4>");
    } else if (response.game.whoseTurn === "black") {
        $("#my-color").append("<h4>It is black's turn</h4>");
    } else {
        $("#my-color").append("<h4>Error: don't know whose turn it is</h4>");
    }

    let whiteSum = 0;
    let blackSum = 0;

    /** animate changes to the board */
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === "w") {
                whiteSum++;
            } else if (board[row][col] === "b") {
                blackSum++;
            }

            if (oldBoard[row][col] !== board[row][col]) {
                /** check to see if the server changed any space on the board */
                let graphic = "";
                let altTag = "";
                if (oldBoard[row][col] !== "?" && board[row][col] === " ") {
                    /** need empty gif */
                    graphic = "empty.gif";
                    altTag = "empty space";
                } else if (
                    oldBoard[row][col] !== "?" &&
                    board[row][col] === "w"
                ) {
                    /** need empty gif */
                    graphic = "e-w.gif";
                    altTag = "white token";
                } else if (
                    oldBoard[row][col] !== "?" &&
                    board[row][col] === "b"
                ) {
                    /** need empty gif */
                    graphic = "e-b.gif";
                    altTag = "black token";
                } else if (
                    oldBoard[row][col] !== " " &&
                    board[row][col] === "w"
                ) {
                    /** need empty gif */
                    graphic = "e-w.gif";
                    altTag = "white token";
                } else if (
                    oldBoard[row][col] !== " " &&
                    board[row][col] === "b"
                ) {
                    /** need empty gif */
                    graphic = "e-b.gif";
                    altTag = "black token";
                } else if (
                    oldBoard[row][col] !== "w" &&
                    board[row][col] === " "
                ) {
                    /** need empty gif */
                    graphic = "w-e.gif";
                    altTag = "empty space";
                } else if (
                    oldBoard[row][col] !== "b" &&
                    board[row][col] === " "
                ) {
                    /** need empty gif */
                    graphic = "b-e.gif";
                    altTag = "empty space";
                } else if (
                    oldBoard[row][col] !== "w" &&
                    board[row][col] === "b"
                ) {
                    /** need empty gif */
                    graphic = "w-b.gif";
                    altTag = "black token";
                } else if (
                    oldBoard[row][col] !== "b" &&
                    board[row][col] === "w"
                ) {
                    /** need empty gif */
                    graphic = "b-w.gif";
                    altTag = "white token";
                } else {
                    /** need empty gif */
                    graphic = "error.gif";
                    altTag = "error";
                }

                const t = Date.now();
                $("#" + row + "_" + col).html(
                    '<img class="img-fluid" src="assets/images/' +
                    graphic +
                    "?time=" +
                    t +
                    '" alt="' +
                    altTag +
                    '"/>'
                );
            }

            /** Set up interactivity */

            $("#" + row + "_" + col).off("click");
            $("#" + row + "_" + col).removeClass("hovered-over");
            if (response.game.whoseTurn === myColor) {
                if (
                    response.game.legalMoves[row][col] ===
                    myColor.substring(0, 1)
                ) {
                    $("#" + row + "_" + col).addClass("hovered-over");
                    $("#" + row + "_" + col).click(
                        ((r, c) => {
                            return () => {
                                let response = {
                                    row: r,
                                    col: c,
                                    color: myColor,
                                };
                                console.log(
                                    "**** client log message, sending 'play_token' command: " +
                                    JSON.stringify(response)
                                );
                                socket.emit("play_token", response);
                            };
                        })(row, col)
                    );
                }
            }
        }
    }

    clearInterval(intervalTimer);
    intervalTimer = setInterval(
        ((lastTime) => {
            return () => {
                let d = new Date();
                let elapsedM = d.getTime() - lastTime;
                let minutes = Math.floor(elapsedM / 1000 / 60);
                let seconds = Math.floor(elapsedM % (60 * 1000)) / 1000;
                let total = minutes * 60 + seconds;
                if (total > 100) {
                    total = 100;
                }
                $("#elapsed")
                    .css("width", total + "%")
                    .attr("aria-valuenow", total);
                let timeString = "" + seconds;
                timeString = timeString.padStart(2, "0");
                timeString = minutes + ":" + timeString;
                if (total < 100) {
                    $("#elapsed").html(timeString);
                } else {
                    $("#elapsed").html("Time's up!");
                }
            };
        })(response.game.lastMoveTime),
        1000
    );

    $("#white-sum").html(whiteSum);
    $("#black-sum").html(blackSum);
    oldBoard = board;
});

socket.on("play_token_response", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        alert(response.message);
        return;
    }
});

socket.on("game_over", (response) => {
    if (typeof response == "undefined" || response === null) {
        console.log("server did not send a response");
        return;
    }
    if (response === "fail") {
        console.log(response.message);
        return;
    }

    /** announce with a button to the lobby */
    let nodeA = $("<div id='game_over'></div>");
    let nodeB = $("<h1>Game Over</h1>");
    let nodeC = $("<h2>" + response.whoWon + " won!</h2>");
    let nodeD = $(
        "<a href='lobby.html?username=" +
        username +
        "' class='btn btn-lg btn-success' role='button'>Return to lobby</a>"
    );
    nodeA.append(nodeB);
    nodeA.append(nodeC);
    nodeA.append(nodeD);
    nodeA.hide();

    $("#game-over").replaceWith(nodeA);
    nodeA.fadeIn(1000);
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
    $("#quit").html(
        $(
            "<a href='lobby.html?username=" +
            username +
            "' class='btn btn-danger' role='button'>Quit</a>"
        )
    );

    $("#chat-message").keypress(function(e) {
        let key = e.which;
        if (key === 13) {
            $("button[id = chat-button]").click();
            return false;
        }
    });
});