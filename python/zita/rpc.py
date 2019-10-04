"""
RPC Server to serve predictions
"""
import orjson
import zmq
import logging

from zita.serve.predict import predict, batch_predict
from zita.settings import LOG_LEVEL, RPC_PORT, DEFAULT_MODEL

DEFAULT_PORT = RPC_PORT
logger = logging.getLogger('zita.rpc')
logger.setLevel(LOG_LEVEL)

# def start_device(port=DEFAULT_PORT):
#     # try:
#     context = zmq.Context(1)

#     # Socket facing clients
#     frontend = context.socket(zmq.XREP)
#     url = f"tcp://*:{port}"
#     print("Binding frontend to %s" % url)
#     frontend.bind(url)

#     # Socket facing services
#     backend = context.socket(zmq.XREQ)
#     url = f"tcp://*:{port + 1}"
#     print("Binding backend to %s" % url)
#     backend.bind(url)

#     zmq.device(zmq.QUEUE, frontend, backend)
#     # except Exception as e:
#     #     print(e)
#     #     print("bringing down zmq device...")
#     # finally:
#     #     frontend.close()
#     #     backend.close()
#     #     context.term()


def start_server(port=DEFAULT_PORT):
    context = zmq.Context()
    socket = context.socket(zmq.REP)
    url = f"tcp://*:{port}"
    logger.debug("Binding server to %s" % url)
    socket.bind(url)

    def end(error):
        reply = {'error': error}
        socket.send(orjson.dumps(reply))

    while True:
        message = socket.recv()
        query = None
        try:
            query = orjson.loads(message)
        except Exception:
            logger.error('Could not parse message: %s', message)
            end('Bad request')
            continue

        if not query:
            end('Bad request')
            continue

        try:
            tags_only = query.get('tagsOnly') or False
            if 'photoId' in query:
                reply = predict(query.get('model') or DEFAULT_MODEL,
                                query['photoId'])
                if tags_only:
                    reply = reply['tags'] if reply else reply
            elif 'photoIds' in query:
                reply = batch_predict(query.get('model') or DEFAULT_MODEL,
                                      query['photoIds'])
                if tags_only:
                    reply = [x['tags'] if x else x for x in reply]
            else:
                end('Unknown operation')
                continue
        except Exception as e:
            logger.error(e, exc_info=True)
            end(str(e))
            continue

        #  Send reply back to client
        socket.send(orjson.dumps(reply))


if __name__ == '__main__':
    import sys
    argv = sys.argv
    if len(argv) > 1:
        start_server(int(argv[1]))
    else:
        start_server()
