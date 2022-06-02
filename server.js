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

/*********************************/
/** Set up the web socket server */

const { Server } = require("socket.io");
const { type } = require("os");
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

    socket.on("disconnect", () => {
        serverLog("a page disconnected from the server: " + socket.id);
    });

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
                serverLog(
                    "there are " + sockets.length + " clients in the room: " + room
                );
                /** Sockets didn't join the room */
                if (
                    typeof sockets == "undefined" ||
                    sockets === null ||
                    !sockets.includes(socket)
                ) {
                    response = {};
                    response.result = "fail";
                    response.message = "server internal error joining the chat room";
                    socket.emit("join_room_response", response);
                    serverLog("join_room command failed", JSON.stringify(response));
                    return;
                } else {
                    /** If the socket did join the room  */
                    response = {};
                    response.result = "success";
                    response.room = room;
                    response.username = username;
                    response.count = sockets.length;

                    /** tell everyone that a new user has joined the chat room */
                    io.of("/").to(room).emit("join_room_response", response);
                    serverLog("join_room command succeeded", JSON.stringify(response));
                }
            });
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