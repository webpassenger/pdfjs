var fs = require('fs');
var mysql = require('mysql');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(express.static(__dirname));
var pool  = mysql.createPool({
    connectionLimit: 100,
    acquireTimeout: 500,
    queueLimit: 100,
    host     : 'localhost',
    user     : 'journals',
    password : 'eyddTtebqRfH6b5x',
    database : 'journals'
});

app.post('/', function(req, res){
    data = req.body;
    if (data.action) handler.action(data,res);
    else handler.answer({action:'undefined', res:'error', error:'unknown action'},res);
});
app.listen(8082);
console.log('Express started');

var MessageHandler = function(socket){
    this.socket = socket;

    this.answer = function(data,res){
        res.send(JSON.stringify(data));
    }

    this.answer_err = function(error,res){
        this.answer({res:'error', error:error}, res);
    }

    this.answer_ok = function(res){
        this.answer({res:'ok'}, res);
    }

    this.action = function(data,res){
        switch (data.action){
            case 'test':
                this.test(data,res);
                break;
            case 'save_page':
                this.save_page(data,res);
                break;
            case 'get_page':
                this.get_page(data,res);
                break;
            default: this.answer_err('unknown action',res);
        }
    }

    this.test = function(data,res){
        var answer = {res:'ok'};
        if (data.data) answer.data = data.data;
        this.answer(answer,res);
    }

    this.save_page = function(data,res){
        var page = data.data.page;
        var context = JSON.stringify(data.data);
        console.log(context.length+' bytes saved to DB');
        pool.getConnection(function(err, connection) {
            if (err !== null){
                //console.log(err);
                handler.answer_err(err.code, res);
                connection.release();
                return false;
            }
            handler.check_journal(connection,data.data,res);
        });
    }

    this.check_journal = function(connection,data,res){
        connection.query( "select count(*) as kolvo from pdf_journals where f_name='"+data.page.name+"'", function(err, result) {
            if (err !== null) {
                //console.log(err);
                handler.answer_err(err.code, res);
                connection.release();
                return false;
            }
            handler.get_journal_id(connection,result[0].kolvo == 0,data,res);
        });
    }

    this.get_journal_id = function(connection,new_id,data,res){
        if (new_id) {
            connection.query( "insert into pdf_journals (f_name) values('"+data.page.name+"')", function(err, result) {
                if (err !== null) {
                    //console.log(err);
                    handler.answer_err(err.code, res);
                    connection.release();
                    return false;
                }
                handler.check_page(connection,result.insertId,data,res);
            });
        }
        else {
            connection.query( "select id from pdf_journals where f_name='"+data.page.name+"'", function(err, result) {
                if (err !== null) {
                    //console.log(err);
                    handler.answer_err(err.code, res);
                    connection.release();
                    return false;
                }
                handler.check_page(connection,result[0].id,data,res);
            });
        }
    }

    this.check_page = function(connection,id,data,res){
        connection.query( "select count(*) as kolvo from pdf_pages where id="+id+" and num_page="+data.page.number+
            " and scale="+data.page.scale, function(err, result) {
            if (err !== null) {
                //console.log(err);
                handler.answer_err(err.code, res);
                connection.release();
                return false;
            }
            handler.save_page_data(connection,result[0].kolvo == 0,id,data,res);
        });
    }

    this.save_page_data = function(connection,new_page,id,data,res){
        if (new_page == true) {
            connection.query( "insert into pdf_pages (id,num_page,scale,commands) values("+id+","+data.page.number+","+data.page.scale+
                ",'"+JSON.stringify(data)+"')", function(err, result) {
                if (err !== null) {
                    //console.log(err);
                    handler.answer_err(err.code, res);
                    connection.release();
                    return false;
                }
                connection.release();
                handler.answer_ok(res);
            });
        }
        else {
            connection.query( "update pdf_pages set commands='"+JSON.stringify(data)+"' where id="+id+" and num_page="+data.page.number+
                " and scale ="+data.page.scale, function(err, result) {
                if (err !== null) {
                    //console.log(err);
                    handler.answer_err(err.code, res);
                    connection.release();
                    return false;
                }
                connection.release();
                handler.answer_ok(res);

            });
        }
    }

    this.get_page = function(data,res){
        pool.getConnection(function(err, connection) {
            if (err !== null){
                //console.log(err);
                handler.answer_err(err.code, res);
                connection.release();
                return false;
            }
            handler.get_journal(connection,data.data,res);
        });
    }

    this.get_journal = function(connection,data,res){
        connection.query( "select id from pdf_journals where f_name='"+data.f_name+"'", function(err, result) {
            if (err !== null) {
                //console.log(err);
                handler.answer_err(err.code, res);
                connection.release();
                return false;
            }
            if ((result.length > 0) && (result[0].id)) handler.get_page_data(connection,result[0].id,data,res);
            else {
                connection.release();
                handler.answer_err(data.f_name+' not found', res);
            }
        });
    }

    this.get_page_data = function(connection,id,data,res){
        connection.query( "select commands from pdf_pages where id="+id+" and num_page="+data.num_page+" and scale="+data.scale, function(err, result) {
            if (err !== null) {
                //console.log(err);
                handler.answer_err(err.code, res);
                connection.release();
                return false;
            }
            var commands = result[0].commands.toString('utf8');
            connection.release();
            if ((result.length > 0) && (result[0].commands)) handler.answer({res:'ok', data:commands}, res);
            else handler.answer_err('Page '+data.num_page+' with scale '+data.scale+' of '+data.f_name+' not found', res);
        });
    }
}

var handler = new MessageHandler();