/* Set up the static file server */

let static = require("node-static");

/* Set up the http server library */
let http = require("http");

/* Assume that we are running on heroku*/
let port = process.env.PORT;
let directory = __dirname + "/public";

/* If we aren't on heroku then we need to adjust port and dir */
if (typeof port == "undefined" || port === null) {
    port = 8080;
    directory = "./public";
}

/* Set up our static file web server to deliver files from the filesystem */
let file = new static.Server(directory);

let app = http
    .createServer(function(request, response) {
        request
            .addListener("end", function() {
                file.serve(request, response);
            })
            .resume();
    })
    .listen(port);

console.log("The server is running");

/** Set up a registry of player info and socket IDs */
let players = [];
/*********************************/
/** Set up the web socket server */

const { Server } = require("socket.io");
const { setServers } = require("dns");
const io = new Server(app);

io.on("connection", (socket) => {
    /** Output a log message on the server and send it to the clients */
    function serverLog(...messages) {
        io.emit("log", ["**** message from the server:\n"]);
        messages.forEach((item) => {
            io.emit("log", ["**** \t" + item]);
            console.log(item);
        });
    }

    serverLog("a page connected to the server: " + socket.id);

    /** join_room command handler */
    /**
     * expected response:
     *  {
     *      'room': the room to be joined,
     *      'username': the name of the user joining the room
     *  }
     */

    /** join_room response:
     *      {
     *          'result': 'success',
     *          'room': the room that was joined,
     *          'username': the user that joined the room,
     *          'count': the number of users in the chat room
     *          'socketId': the socket of the user that just joined the room
     *      }
     * or
     *
     *      {
     *          'result': 'fail',
     *          'message': the reason for failure
     *      }
     */
    socket.on("join_room", (request) => {
        serverLog(
            "server received a command",
            "'join_room'",
            JSON.stringify(request)
        );

        /** Check that the data from the client is good */
        if (typeof request == "undefined" || request === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a request";
            socket.emit("join_room_response", response);
            serverLog("join_room command failed", JSON.stringify(response));
            return;
        }
        let room = request.room;
        let username = request.username;

        if (typeof room == "undefined" || room === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid room to join";
            socket.emit("join_room_response", response);
            serverLog("join_room command failed", JSON.stringify(response));
            return;
        }
        if (typeof username == "undefined" || username === null) {
            response = {};
            response.result = "fail";
            response.message =
                "client did not send a valid username to join the chat room";
            socket.emit("join_room_response", response);
            serverLog("join_room command failed", JSON.stringify(response));
            return;
        }

        /** Handle the command */
        socket.join(room);

        /** Make sure the client was put in the room */
        io.in(room)
            .fetchSockets()
            .then((sockets) => {
                /** Sockets didn't join the room */
                if (
                    typeof sockets == "undefined" ||
                    sockets === null ||
                    !sockets.includes(socket)
                ) {
                    response = {};
                    response.result = "fail";
                    response.message =
                        "server internal error joining the chat room";
                    socket.emit("join_room_response", response);
                    serverLog(
                        "join_room command failed",
                        JSON.stringify(response)
                    );
                    return;
                } else {
                    players[socket.id] = {
                        username: username,
                        room: room,
                    };

                    /** If the socket did join the room  */
                    /** Announce to everyone in the room who else is in the room */

                    for (const member of sockets) {
                        response = {
                            result: "success",
                            socketId: member.id,
                            room: players[member.id].room,
                            username: players[member.id].username,
                            count: sockets.length,
                        };
                        /** tell everyone that a new user has joined the chat room */
                        io.of("/")
                            .to(room)
                            .emit("join_room_response", response);
                        serverLog(
                            "join_room command succeeded",
                            JSON.stringify(response)
                        );
                        if (room !== "Lobby") {
                            send_game_update(socket, room, "initial update");
                        }
                    }
                }
            });
    });

    socket.on("invite", (request) => {
        serverLog(
            "server received a command",
            "'invite'",
            JSON.stringify(request)
        );

        /** Check that the data from the client is good */
        if (typeof request == "undefined" || request === null) {
            response = {
                result: "fail",
                message: "client did not send a request",
            };
            socket.emit("invite_response", response);
            serverLog("invite command failed", JSON.stringify(response));
            return;
        }
        let requested_user = request.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if (
            typeof requested_user == "undefined" ||
            requested_user === null ||
            requested_user === ""
        ) {
            response = {
                result: "fail",
                message: "client did not request a valid user",
            };
            socket.emit("invite_response", response);
            serverLog("invite command failed", JSON.stringify(response));
            return;
        }

        if (typeof room == "undefined" || room === null || room === "") {
            response = {
                result: "fail",
                message: "the user that was invited is not in a room",
            };

            socket.emit("invite_response", response);
            serverLog("invite command failed", JSON.stringify(response));
            return;
        }
        if (
            typeof username == "undefined" ||
            username === null ||
            username === ""
        ) {
            response = {
                result: "fail",
                message: "the user that was involved does not have a name registered",
            };
            socket.emit("invite_response", response);
            serverLog("invite command failed", JSON.stringify(response));
            return;
        }

        /** Make sure that the invited player is present */
        io.in(room)
            .allSockets()
            .then((sockets) => {
                /** Sockets didn't join the room */

                /** invitee isn't in the link */
                if (
                    typeof sockets == "undefined" ||
                    sockets === null ||
                    !sockets.has(requested_user)
                ) {
                    response = {
                        result: "fail",
                        message: "user invited is no longer in the room",
                    };
                    socket.emit("invite_response", response);
                    serverLog(
                        "invite command failed",
                        JSON.stringify(response)
                    );
                    return;
                } else {
                    /** invitee is in the room  */
                    response = {
                        result: "success",
                        socketId: requested_user,
                    };
                    socket.emit("invite_response", response);

                    response = {
                        result: "success",
                        socketId: socket.id,
                    };
                    socket.to(requested_user).emit("invited", response);
                    serverLog(
                        "invite command succeeded",
                        JSON.stringify(response)
                    );
                }
            });
    });

    socket.on("uninvite", (request) => {
        serverLog(
            "server received a command",
            "'uninvite'",
            JSON.stringify(request)
        );

        /** Check that the data from the client is good */
        if (typeof request == "undefined" || request === null) {
            response = {
                result: "fail",
                message: "client did not send a request",
            };
            socket.emit("uninvited", response);
            serverLog("uninvite command failed", JSON.stringify(response));
            return;
        }
        let requested_user = request.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if (
            typeof requested_user == "undefined" ||
            requested_user === null ||
            requested_user === ""
        ) {
            response = {
                result: "fail",
                message: "client did not request a valid user to uninvite",
            };
            socket.emit("uninvite", response);
            serverLog("uninvite command failed", JSON.stringify(response));
            return;
        }

        if (typeof room == "undefined" || room === null || room === "") {
            response = {
                result: "fail",
                message: "the user that was uninvited is not in a room",
            };

            socket.emit("uninvited", response);
            serverLog("uninvite command failed", JSON.stringify(response));
            return;
        }
        if (
            typeof username == "undefined" ||
            username === null ||
            username === ""
        ) {
            response = {
                result: "fail",
                message: "the user that was uninvited does not have a name registered",
            };
            socket.emit("uninvited", response);
            serverLog("uninvite command failed", JSON.stringify(response));
            return;
        }

        /** Make sure that the uninvited player is present */
        io.in(room)
            .allSockets()
            .then((sockets) => {
                /** Sockets didn't join the room */

                /** invitee isn't in the link */
                if (
                    typeof sockets == "undefined" ||
                    sockets === null ||
                    !sockets.has(requested_user)
                ) {
                    response = {
                        result: "fail",
                        message: "user uninvited is no longer in the room",
                    };
                    socket.emit("uninvited", response);
                    serverLog(
                        "uninvite command failed",
                        JSON.stringify(response)
                    );
                    return;
                } else {
                    /** invitee is in the room  */
                    response = {
                        result: "success",
                        socketId: requested_user,
                    };
                    socket.emit("uninvited", response);

                    response = {
                        result: "success",
                        socketId: socket.id,
                    };
                    socket.to(requested_user).emit("uninvited", response);
                    serverLog(
                        "uninvite command succeeded",
                        JSON.stringify(response)
                    );
                }
            });
    });

    socket.on("game_start", (request) => {
        serverLog(
            "server received a command",
            "'game_start'",
            JSON.stringify(request)
        );

        /** Check that the data from the client is good */
        if (typeof request == "undefined" || request === null) {
            response = {
                result: "fail",
                message: "client did not send a request",
            };
            socket.emit("game_start_response", response);
            serverLog("game_start command failed", JSON.stringify(response));
            return;
        }
        let requested_user = request.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if (
            typeof requested_user == "undefined" ||
            requested_user === null ||
            requested_user === ""
        ) {
            response = {
                result: "fail",
                message: "client did not request a valid user to engage in play",
            };
            socket.emit("game_start_response", response);
            serverLog("game_start command failed", JSON.stringify(response));
            return;
        }

        if (typeof room == "undefined" || room === null || room === "") {
            response = {
                result: "fail",
                message: "the user that was engaged is not in a room",
            };

            socket.emit("game_start_response", response);
            serverLog("game_start command failed", JSON.stringify(response));
            return;
        }
        if (
            typeof username == "undefined" ||
            username === null ||
            username === ""
        ) {
            response = {
                result: "fail",
                message: "the user that was engaged does not have a name registered",
            };
            socket.emit("game_start_response", response);
            serverLog("game_start command failed", JSON.stringify(response));
            return;
        }

        /** Make sure that the uninvited player is present */
        io.in(room)
            .allSockets()
            .then((sockets) => {
                /** Sockets didn't join the room */

                /** engaged player isn't in the link */
                if (
                    typeof sockets == "undefined" ||
                    sockets === null ||
                    !sockets.has(requested_user)
                ) {
                    response = {
                        result: "fail",
                        message: "user engaged is no longer in the room",
                    };
                    socket.emit("game_start_response", response);
                    serverLog(
                        "game_start command failed",
                        JSON.stringify(response)
                    );
                    return;
                } else {
                    /** engaged player is in the room  */

                    let gameId = Math.floor(
                        1 + Math.random() * 0x100000
                    ).toString(16);

                    response = {
                        result: "success",
                        socketId: requested_user,
                        gameId: gameId,
                    };
                    socket.emit("game_start_response", response);
                    socket
                        .to(requested_user)
                        .emit("game_start_response", response);
                    serverLog(
                        "game_start command succeeded",
                        JSON.stringify(response)
                    );
                }
            });
    });

    socket.on("disconnect", () => {
        serverLog("a page disconnected from the server: " + socket.id);

        if (
            typeof players[socket.id] != "undefined" &&
            players[socket.id] != null
        ) {
            let response = {
                username: players[socket.id].username,
                room: players[socket.id].room,
                count: Object.keys(players).length - 1,
                socketId: socket.id,
            };
            let room = players[socket.id].room;
            delete players[socket.id];

            /** Tell everyone who left the room */
            io.of("/").to(room).emit("player_disconnected", response);
            serverLog(
                "player_disconnected succeeded",
                JSON.stringify(response)
            );
        }
    });

    /** send_chat_message command handler */
    /**
     * expected response:
     *  {
     *      'room': the room to which the message should be sent,
     *      'username': the name of the sender
     *      'message': the message to be broadcast
     *  }
     */

    /** send_chat_message response:
     *      {
     *          'result': 'success',
     *          'username': the user that sent the message,
     *          'message': the message that was sent
     *      }
     * or
     *
     *      {
     *          'result': 'fail',
     *          'message': the reason for failure
     *      }
     */

    socket.on("send_chat_message", (request) => {
        serverLog(
            "server received a command",
            "'send_chat_message'",
            JSON.stringify(request)
        );

        /** Check that the data from the client is good */
        if (typeof request == "undefined" || request === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a request";
            socket.emit("send_chat_message_response", response);
            serverLog(
                "send_chat_message command failed",
                JSON.stringify(response)
            );
            return;
        }
        let room = request.room;
        let username = request.username;
        let message = request.message;
        if (typeof room == "undefined" || room === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid room to message";
            socket.emit("send_chat_message_response", respsonse);
            serverLog(
                "send_chat_message command failed",
                JSON.stringify(response)
            );
            return;
        }
        if (typeof username == "undefined" || username === null) {
            response = {};
            response.result = "fail";
            response.message =
                "client did not send a valid username as a message source";
            socket.emit("send_chat_message_response", response);
            serverLog(
                "send_chat_message command failed",
                JSON.stringify(response)
            );
            return;
        }
        if (typeof message == "undefined" || message === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid message";
            socket.emit("send_chat_message_response", response);
            serverLog(
                "send_chat_message command failed",
                JSON.stringify(response)
            );
            return;
        }
        /** Handle the command */
        let response = {};
        response.result = "success";
        response.username = username;
        response.room = room;
        response.message = message;
        /** tell everyone in the room the message */
        io.of("/").to(room).emit("send_chat_message_response", response);
        serverLog(
            "send_chat_message command succeded",
            JSON.stringify(response)
        );
    });

    socket.on("play_token", (payload) => {
        serverLog(
            "server received a command",
            "'play_token'",
            JSON.stringify(payload)
        );

        /** Check that the data from the client is good */
        if (typeof payload == "undefined" || payload === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a request";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let player = players[socket.id];
        if (typeof player == "undefined" || player === null) {
            response = {};
            response.result = "fail";
            response.message = "play_token came from an unregistered player";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let username = player.username;
        if (typeof username == "undefined" || username === null) {
            response = {};
            response.result = "fail";
            response.message =
                "play_token command did not come from a registered username";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let gameId = player.room;
        if (typeof gameId == "undefined" || gameId === null) {
            response = {};
            response.result = "fail";
            response.message =
                "there was no valid play associated with the play_token command";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let row = payload.row;
        if (typeof row == "undefined" || row === null) {
            response = {};
            response.result = "fail";
            response.message =
                "there was no valid row associated with the play_token command";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let col = payload.col;
        if (typeof col == "undefined" || col === null) {
            response = {};
            response.result = "fail";
            response.message =
                "there was no valid column associated with the play_token command";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let color = payload.color;
        if (typeof color == "undefined" || color === null) {
            response = {};
            response.result = "fail";
            response.message =
                "there was no valid color associated with the play_token command";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        let game = games[gameId];
        if (typeof game == "undefined" || game === null) {
            response = {};
            response.result = "fail";
            response.message =
                "there was no valid game associated with the play_token command";
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        /** make sure the current attempt is made by the correct color */
        if (color !== game.whoseTurn) {
            let response = {
                result: "fail",
                message: "play_token played the wrong color. It's not their turn",
            };
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        /** make sure the current play is coming from the expected player */
        if (
            (game.whoseTurn === "white" &&
                game.playerWhite.socket != socket.id) ||
            (game.whoseTurn === "black" && game.playerBlack.socket != socket.id)
        ) {
            let response = {
                result: "fail",
                message: "play_token played the right color but by the wrong person",
            };
            socket.emit("play_token_response", response);
            serverLog("play_token command failed", JSON.stringify(response));
            return;
        }

        /** Handle the command */
        let response = {
            result: "success",
        };
        /** tell everyone in the room the message */
        socket.emit("play_token_response", response);

        if (color === "white") {
            game.board[row][col] = "w";
            flipTokens("w", row, col, game.board);

            game.whoseTurn = "black";
            game.legalMoves = calculateLegalMoves("b", game.board);
        } else {
            game.board[row][col] = "b";
            flipTokens("b", row, col, game.board);

            game.whoseTurn = "white";
            game.legalMoves = calculateLegalMoves("w", game.board);
        }

        let d = new Date();
        game.lastMoveTime = d.getTime();

        send_game_update(socket, gameId, "played a token");
    });
});

/*************************************/
/** Code related to game state */
let games = [];

function create_new_game(gameId) {
    let newGame = {};
    newGame.playerWhite = {};
    newGame.playerWhite.socket = "";
    newGame.playerWhite.username = "";

    newGame.playerBlack = {};
    newGame.playerBlack.socket = "";
    newGame.playerBlack.username = "";

    var d = new Date();
    newGame.lastMoveTime = d.getTime();

    newGame.whoseTurn = "black";

    newGame.board = [
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", "w", "b", " ", " ", " "],
        [" ", " ", " ", "b", "w", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
    ];

    newGame.legalMoves = calculateLegalMoves("b", newGame.board);

    return newGame;
}

function checkLineMatch(color, dr, dc, r, c, board) {
    if (board[r][c] === color) {
        return true;
    }

    if (board[r][c] === " ") {
        return false;
    }

    /** check to make sure we didn't walk off the board */
    if (r + dr < 0 || r + dr > 7) {
        return false;
    }
    if (c + dc < 0 || c + dc > 7) {
        return false;
    }

    return checkLineMatch(color, dr, dc, r + dr, c + dc, board);
}

/** return true if r + dr supports  playing at r and if c + dc supports playing at c */
function adjacentSupport(who, dr, dc, r, c, board) {
    let other;
    if (who === "b") {
        other = "w";
    } else if (who === "w") {
        other = "b";
    } else {
        console.log("Houston we have a problem" + who);
        return false;
    }

    /** check to make sure that the adjacent support is on the board */
    if (r + dr < 0 || r + dr > 7) {
        return false;
    }
    if (c + dc < 0 || c + dc > 7) {
        return false;
    }

    /** check that the opposite color is present */
    if (board[r + dr][c + dc] !== other) {
        return false;
    }

    /** check to make sure that there is a space for a matching color to capture tokens */
    if (r + dr + dr < 0 || r + dr + dr > 7) {
        return false;
    }
    if (c + dc + dc < 0 || c + dc + dc > 7) {
        return false;
    }

    return checkLineMatch(who, dr, dc, r + dr + dr, c + dc + dc, board);
}

function calculateLegalMoves(who, board) {
    let legalMoves = [
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
    ];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === " ") {
                nw = adjacentSupport(who, -1, -1, row, col, board);
                nn = adjacentSupport(who, -1, 0, row, col, board);
                ne = adjacentSupport(who, -1, 1, row, col, board);

                ww = adjacentSupport(who, 0, -1, row, col, board);
                ee = adjacentSupport(who, 0, 1, row, col, board);

                sw = adjacentSupport(who, 1, -1, row, col, board);
                ss = adjacentSupport(who, 1, 0, row, col, board);
                se = adjacentSupport(who, 1, 1, row, col, board);
                if (nw || nn || ne || ww || ee || sw || ss || se) {
                    legalMoves[row][col] = who;
                }
            }
        }
    }
    return legalMoves;
}

function flipLine(who, dr, dc, r, c, board) {
    if (r + dr < 0 || r + dr > 7) {
        return false;
    }
    if (c + dc < 0 || c + dc > 7) {
        return false;
    }

    /** check that the opposite color is present */
    if (board[r + dr][c + dc] === " ") {
        return false;
    }

    if (board[r + dr][c + dc] === who) {
        return true;
    } else {
        if (flipLine(who, dr, dc, r + dr, c + dc, board)) {
            board[r + dr][c + dc] = who;
            return true;
        } else {
            return false;
        }
    }
}

function flipTokens(who, row, col, board) {
    flipLine(who, -1, -1, row, col, board);
    flipLine(who, -1, 0, row, col, board);
    flipLine(who, -1, 1, row, col, board);

    flipLine(who, 0, -1, row, col, board);
    flipLine(who, 0, 1, row, col, board);

    flipLine(who, 1, -1, row, col, board);
    flipLine(who, 1, 0, row, col, board);
    flipLine(who, 1, 1, row, col, board);
}

function send_game_update(socket, gameId, message) {
    /** Check to see if a game with gameId exists and if not then make it */
    /** make sure only two people are in the room */
    /** Assign both sockets a color */
    /** send game update */
    /** check to see if game is over */
    if (typeof games[gameId] == "undefined" || games[gameId] === null) {
        console.log(
            "no game exists with game ID: " +
            gameId +
            ". Making a new game for " +
            socket.id
        );
        games[gameId] = create_new_game();
    }

    io.of("/")
        .to(gameId)
        .allSockets()
        .then((sockets) => {
            const iterator = sockets[Symbol.iterator]();
            if (sockets.size >= 1) {
                let first = iterator.next().value;
                if (
                    games[gameId].playerWhite.socket != first &&
                    games[gameId].playerBlack.socket != first
                ) {
                    /** player does not have a color yet */
                    if (games[gameId].playerWhite.socket === "") {
                        console.log("white is assigned to: " + first);
                        games[gameId].playerWhite.socket = first;
                        games[gameId].playerWhite.username =
                            players[first].username;
                    } else if (games[gameId].playerBlack.socket === "") {
                        console.log("black is assigned to: " + first);
                        games[gameId].playerBlack.socket = first;
                        games[gameId].playerBlack.username =
                            players[first].username;
                    } else {
                        /** if not black or white then a third player and must be kicked out */
                        console.log(
                            "kicking " + first + " out of game: " + gameId
                        );
                        io.in(first).socketsLeave([gameId]);
                    }
                }
            }

            if (sockets.size >= 2) {
                let second = iterator.next().value;
                if (
                    games[gameId].playerWhite.socket != second &&
                    games[gameId].playerBlack.socket != second
                ) {
                    /** player does not have a color yet */
                    if (games[gameId].playerWhite.socket === "") {
                        console.log("white is assigned to: " + second);
                        games[gameId].playerWhite.socket = second;
                        games[gameId].playerWhite.username =
                            players[second].username;
                    } else if (games[gameId].playerBlack.socket === "") {
                        console.log("black is assigned to: " + second);
                        games[gameId].playerBlack.socket = second;
                        games[gameId].playerBlack.username =
                            players[second].username;
                    } else {
                        /** if not black or white then a third player and must be kicked out */
                        console.log(
                            "kicking " + second + " out of game: " + gameId
                        );
                        io.in(second).socketsLeave([gameId]);
                    }
                }
                let response = {
                    result: "success",
                    gameId: gameId,
                    game: games[gameId],
                    message: message,
                };

                io.of("/").to(gameId).emit("game_update", response);
            }
        });
    /** check if the game is over */
    let legalMoves = 0;
    let whiteSum = 0;
    let blackSum = 0;

    for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 8; column++) {
            if (games[gameId].legalMoves[row][column] !== " ") {
                legalMoves++;
            }
            if (games[gameId].board[row][column] === "w") {
                whiteSum++;
            }
            if (games[gameId].board[row][column] === "b") {
                blackSum++;
            }
        }
    }
    if (legalMoves === 0) {
        let winner;
        if (whiteSum > blackSum) {
            winner = "white";
        } else if (whiteSum < blackSum) {
            winner = "black";
        } else {
            winner = "Tie Game";
        }

        let response = {
            result: "success",
            gameId: gameId,
            game: games[gameId],
            whoWon: winner,
        };
        io.in(gameId).emit("game_over", response);

        /* Delete old games after one hour */
        setTimeout(
            ((id) => {
                return () => {
                    delete games[id];
                };
            })(gameId),
            60 * 60 * 1000
        );
    }
}