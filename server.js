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
        io.in(room).fetchSockets().then((sockets) => {
            /** Sockets didn't join the room */
            if (typeof sockets == "undefined" || sockets === null || !sockets.includes(socket)) {
                response = {};
                response.result = "fail";
                response.message = "server internal error joining the chat room";
                socket.emit("join_room_response", response);
                serverLog("join_room command failed", JSON.stringify(response));
                return;
            } else {
                players[socket.id] = {
                    username: username,
                    room: room,
                }

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
                    io.of("/").to(room).emit("join_room_response", response);
                    serverLog("join_room command succeeded", JSON.stringify(response));
                }

            }
        });
    });


    socket.on("invite", (request) => {
        serverLog("server received a command", "'invite'", JSON.stringify(request));

        /** Check that the data from the client is good */
        if (typeof request == "undefined" || request === null) {
            response = {
                result: "fail",
                message: "client did not send a request",
            }
            socket.emit("invite_response", response);
            serverLog("invite command failed", JSON.stringify(response));
            return;
        }
        let requested_user = request.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if (typeof requested_user == "undefined" || requested_user === null || requested_user === "") {
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
        if (typeof username == "undefined" || username === null || username === "") {
            response = {
                result: "fail",
                message: "the user that was involved does not have a name registered",
            };
            socket.emit("invite_response", response);
            serverLog("invite command failed", JSON.stringify(response));
            return;
        }

        /** Make sure that the invited player is present */
        io.in(room).allSockets().then((sockets) => {
            /** Sockets didn't join the room */

            /** invitee isn't in the link */
            if (typeof sockets == "undefined" || sockets === null || !sockets.has(requested_user)) {
                response = {
                    result: "fail",
                    message: "user invited is no longer in the room",
                };
                socket.emit("invite_response", response);
                serverLog("invite command failed", JSON.stringify(response));
                return;
            }
            /** invitee is in the room  */
            else {
                response = {
                    result: 'success',
                    socketId: requested_user,
                }
                socket.emit('invite_response', response)

                response = {
                    result: 'success',
                    socketId: socket.id,
                }
                socket.to(requested_user).emit('invited', response);
                serverLog("invite command succeeded", JSON.stringify(response));
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
        if (typeof username == "undefined" || username === null || username === "") {
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
                if (typeof sockets == "undefined" || sockets === null || !sockets.has(requested_user)) {
                    response = {
                        result: "fail",
                        message: "user uninvited is no longer in the room",
                    };
                    socket.emit("uninvited", response);
                    serverLog("uninvite command failed", JSON.stringify(response));
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
                    serverLog("uninvite command succeeded", JSON.stringify(response));
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
                    serverLog("game_start command failed", JSON.stringify(response));
                    return;
                } else {
                    /** engaged player is in the room  */

                    let gameId = Math.floor(1 + Math.random() * 0x100000).toString(16);

                    response = {
                        result: "success",
                        socketId: requested_user,
                        gameId: gameId,
                    };
                    socket.emit("game_start_response", response);
                    socket.to(requested_user).emit("game_start_response", response);
                    serverLog("game_start command succeeded", JSON.stringify(response));
                }
            });
    });



    socket.on("disconnect", () => {
        serverLog("a page disconnected from the server: " + socket.id);

        if (typeof players[socket.id] != "undefined" && players[socket.id] != null) {
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
            serverLog("player_disconnected succeeded", JSON.stringify(response));
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
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }
        let room = request.room;
        let username = request.username;
        let message = request.message;
        if (typeof room == "undefined" || room === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid room to message";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }
        if (typeof username == "undefined" || username === null) {
            response = {};
            response.result = "fail";
            response.message =
                "client did not send a valid username as a message source";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }
        if (typeof message == "undefined" || message === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid message";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
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
        serverLog("send_chat_message command succeded", JSON.stringify(response));
    });
});