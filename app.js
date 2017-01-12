var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mongoose = require('mongoose'),
	users = {};
var rooms = {};
var sockets = {};
var groups = {};

server.listen(3000);
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

app.get('/', function(req, res) {
	res.sendfile(__dirname + '/index.html');
});
app.get('/:username/:groupid', function(req, res){
	var tempUsername = req.params.username;
	var tempGroupID = req.params.groupid;
	user.findOne({"local.username":tempUsername}, function(err, theUser){
        if (err) {
            res.send(err);
        }
        if (!theUser) {
            res.send('There is no account for this username.');
        }
        else {
            group.findOne({"groupName":tempGroupID}, function(err, theGroup) {
                if (err) {
                    res.send(err);
                }
                if (!theGroup) {
                    res.send('There exists no group for this groupid.');
                }
                else {
                	//Start Sending back files with header information
                	var fileName = __dirname + '/index.html';
                    var options = {
					    headers: {
					       'User' : tempUsername,  
					       'Group' : tempGroupID
					    }
					};
					res.sendFile(fileName, options,function (err) {
					    if (err) {
					      console.log(err);
					      res.status(err.status).end();
					    }
					    else {
					      console.log('Sent:', fileName);
					    }
					});
                }
            });
        }
    });
});

var myTable = {};
io.sockets.on('connection', function(socket){
	// var query = Chat.find({});
	// query.sort('-created').limit(20).exec(function(err, docs){
	// 	if (err) {
	// 		throw err;
	// 	} else {
	// 		socket.emit('load old msgs', docs);
	// 	}
	// });
	
	socket.on('new user', function(chatUser, chatGroup, callback){
		console.log('hit');
		user.findOne({"local.username":chatUser}, function(err, theUser){
	        if (err) {
	            console.log(err);
	            callback(false);
	        }
	        if (!theUser || chatUser == '') {
	        	console.log('Did not find user.');
	        	callback(false);
	        }
	        else {
	        	callback(true);
	        	console.log('find user and set up the profile');
				socket.nickname = chatUser;
				socket.groupid = chatGroup;
				socket.join(chatGroup);

				//sockets[chatUser] = socket;
				//groups[groups.length] =  chatGroup;
				if (chatGroup in groups) {
					groups[chatGroup].push(chatUser);
				} else {
					groups[chatGroup] = [chatUser];
				}
				console.log(groups[chatGroup]);				
				rooms[chatUser] = chatGroup;
				updateNicknames(chatGroup);
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
		console.log('check userId:  '+ groups);
		console.log('check groupID:  '+ socket.groupid);
		console.log('check userId:  '+ usersInGroup);
		console.log('update username');
		io.sockets.in(groupid).emit('usernames', usersInGroup);
	}

	socket.on('disconnect', function(data){
		if (!socket.nickname) {
			return;
		} else {
			groups[socket.groupid].pop(socket.nickname);
			updateNicknames(socket.groupid);
		}
	});
});