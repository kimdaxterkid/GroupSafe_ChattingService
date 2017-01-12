var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose'),
    http = require('http'),
    users = {};
var request = require('request');

var rooms = {};
var sockets = {};
var groups = {};

server.listen(3000);

addUser("sunghaa","1234");

var Schema = mongoose.Schema;
var mongoURL = 'mongodb://vtgroupsafe:123@ec2-54-158-251-62.compute-1.amazonaws.com:27017/dummyDB';

mongoose.connect(mongoURL, function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to mongodb!');
    }
});

var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    created: {type: Date, default: Date.now}
});

var userSchema = new Schema(
{
    local : {
        username: {
            type: String,
            required: true,
            unique: true
        },
        phoneNumber: {
            type        :String,
            required    :   true,
            unique      :   true
        },
        firstName : {
            type: String,
            required: true
        },
        lastName : {
            type : String,
            required : true
        },
        password: {
            type : String,
            required: true
        },
        groups: {
            type : [{type: Schema.ObjectId, ref: 'Groups'}],
            default:[]
        }
    }
}, 
{
    timestamps: true
}
);

var groupSchema = new Schema({
    groupName: {
        type: String,
        required: true,
        unique: true
    },
    members: {
        //later change [String] to [{type: Schema.ObjectId, ref: 'Groups'}]
        type : [String],
        "default" : [],
        required : true
    },
    range : {
        type : Number,
        required : true
    }
}, {
    timestamps: true
});

var group = mongoose.model('Group', groupSchema);
var Chat = mongoose.model('Message', chatSchema);
var user = mongoose.model('users', userSchema);

io.sockets.on('connection', function(socket){
    // var query = Chat.find({});
    // query.sort('-created').limit(20).exec(function(err, docs){
    //  if (err) {
    //      throw err;
    //  } else {
    //      socket.emit('load old msgs', docs);
    //  }
    // });
    
    socket.on('new user', function(chatUser, chatGroup){
        user.findOne({"local.username":chatUser}, function(err, theUser){
            if (err) {
                console.log(err);
            }
            if (!theUser || chatUser == '') {
                console.log('Did not find user.');
            }
            else {
                console.log('find user and set up the profile');
                socket.nickname = chatUser;
                socket.groupid = chatGroup;
                socket.join(chatGroup);

                if (chatGroup in groups) {
                    groups[chatGroup].push(chatUser);
                } else {
                    groups[chatGroup] = [chatUser];
                }

                //  其实也不是必须的...可以删掉
                rooms[chatUser] = chatGroup;
                updateNicknames(chatGroup);
                //  Test part
                socket.broadcast.to(chatGroup).emit('new user join group', {nick: socket.nickname});

                
                //addUserToGroup (socket.groupid, socket.nickname); 
                addUser (socket.nickname, theUser.password, socket.groupid);
                //io.sockets.in(chatGroup).emit('new user join group', {nick: socket.nickname});
            }    
        });
    });


    socket.on('send message', function(data, callback){
        var msg = data.trim();
        var newMsg = new Chat({msg: msg, nick: socket.nickname});
        newMsg.save(function(err){
            if (err) {
                throw err;
            } else {
                io.sockets.in(socket.groupid).emit('new message', {msg: msg, nick: socket.nickname});
            }
        });
    });

    function updateNicknames(groupid) {
        var usersInGroup = groups[groupid];
        console.log('check groupID:  '+ socket.groupid);
        console.log('check userId:  '+ usersInGroup);
        io.sockets.in(groupid).emit('usernames', usersInGroup);
    }

    socket.on('locationUpdate', function(xCoor, yCoor){
        socket.broadcast.in(socket.groupid).emit('someoneElseUpdateLocation', {nick: socket.nickname, x: xCoor, y: yCoor});
    }); 

    socket.on('changeNewHost', function(newHostName){
        io.sockets.in(socket.groupid).emit('changeHostOnMySide', {hostName: newHostName});
    });
    
    socket.on('disconnect', function(){
        if (!socket.nickname) {
            return;
        } else {
            groups[socket.groupid].pop(socket.nickname);
            console.log(socket.nickname);
            io.sockets.in(socket.groupid).emit('leaveMessage', {nick: socket.nickname});
            //  io.sockets.in(socket.groupid).emit('leaveMessage', {nick: socket.nickname});
            updateNicknames(socket.groupid);
            console.log('Start delete');
            //var tempUrl = 'http://54.158.251.62:8080/groups/deletegroup11/?members=' + socket.nickname;
            //var path = "/groups/deletegroup11/?members=a"+ socket.nickname ;
            deleteUser(socket.nickname, socket.groupid);
        }
    });
    socket.on('leaveGroup', function(data){
        if (!socket.nickname) {
            return;
        } else {
            groups[socket.groupid].pop(socket.nickname);
            console.log(socket.nickname);
            io.sockets.in(socket.groupid).emit('leaveMessage', {nick: socket.nickname});
            //  io.sockets.in(socket.groupid).emit('leaveMessage', {nick: socket.nickname});
            updateNicknames(socket.groupid);
            console.log('Start leavegroup');
            //var tempUrl = 'http://54.158.251.62:8080/groups/deletegroup11/?members=' + socket.nickname;
            //var path = "/groups/deletegroup11/?members=a"+ socket.nickname ;
            deleteUser(socket.nickname, socket.groupid);
        }
    });

    socket.on('reconnect', function() {
        console.log('reconnect fired!');
        socket.join(socket.groupid);

        //  Test part
        io.sockets.in(socket.groupid).emit('someoneBack', {nick: socket.nickname});
    });

    socket.on('kickUser', function(username){
        console.log('kickUser Hit');
        io.sockets.in(socket.groupid).emit('someoneKicked', {nick: username});
    });

});



/*
app.delete('/deleteUserFromGroup', function(req, res) {
    
    var groupId = req.query.groupName;
    var userId = req.query.members;
    console.log(groupId);
    console.log(userId);
    
    
    if (!userId) {
        console.log('notin');
        res.end();
    } else {
        groups[groupId].pop(userId);
        //socket.broadcast.to(groupId).emit('leaveMessage', {nick: userId});
        updateNicknames(groupId);
    }
    
    res.end();
});
*/



/* //For test don't delete!!!!
function test(){
    var http = require('http');
    var options = {
      host: 'ec2-54-158-251-62.compute-1.amazonaws.com',
      port: "4000",
      path: "/andy",
      method: 'get'
    };

    var req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
      });
      res.on('end', () => {
        console.log('No more data in response.');
      });
    });

    req.on('error', (e) => {
      console.log(`problem with request: ${e.message}`);
    });

    // write data to request body
    
    req.end();
}
*/

function deleteUser (name, groupName) {
    var thePath = '/groups/'+ groupName + '?members=' + name;
    console.log(thePath);
    var http = require('http');
    var options = {
        host: 'ec2-54-158-251-62.compute-1.amazonaws.com',
        port: "8080",
        path: thePath,
        method: 'delete',
    };

    var req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
      });
      res.on('end', () => {
        console.log('No more data in response.');
      });
    });

    req.on('error', (e) => {
      console.log(`problem with request: ${e.message}`);
    }); 
    req.end();
}


function addUser (username, password, groupName) {
    var sendBody = {
                        "username":username,
                        "password":password
                   };
    request({
        url: "http://ec2-54-158-251-62.compute-1.amazonaws.com:8080/users/login",
        method: "POST",
        json: true,   // <--Very important!!!
        body: sendBody
    }, function (error, response, body){

        console.log('addUser: ');
        addUserToGroup(groupName, username);
    });
}

function addUserToGroup (groupName, userName) {
    var sendBody = {
                        "members":userName
                   };
    request({
        url: "http://ec2-54-158-251-62.compute-1.amazonaws.com:8080/groups/"+groupName,
        method: "PUT",
        json: true,   // <--Very important!!!
        body: sendBody
    }, function (error, response, body){

        console.log('addUserToGroup: ');
    });
}



