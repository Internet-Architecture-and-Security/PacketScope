import sqlite3 as sql


global database,attachtime
database=sql.connect("./.cache/FunctionInfo.db")
global cursor
cursor=database.cursor()

cursor.execute("SELECT name FROM pragma_table_info('SpecfunctionCall')")
database.commit()
print(cursor.fetchall())
cursor.execute("SELECT ID, COUNT(*) AS sales_count FROM functionCall GROUP BY ID ORDER BY sales_count DESC")
# cursor.execute("FROM functionCall")
# cursor.execute("GROUP BY ID")
# cursor.execute("ORDER BY sales_count DESC;")
database.commit()
print(cursor.fetchall())
# [(36068, 1204211), (36072, 1204190), (56893, 1193557), (111443, 1184999), (119724, 1184997), (138163, 1175991), (121812, 934572), (68526, 498577), (84954, 496853), (135594, 482325), (135604, 448916), (135605, 447970), (129406, 447136), (135567, 446493), (116419, 446420), (112208, 443916), (135599, 440769), (112190, 439392), (112077, 438864), (112309, 438837), (84952, 438333), (138142, 437777), (135643, 436442), (119725, 425724), (111444, 425724), (111437, 421610), (138164, 419696), (36070, 67629), (36074, 42424)]
DisabledList=["____sys_recvmsg","___sys_recvmsg","sock_recvmsg","security_socket_recvmsg",
              "apparmor_socket_recvmsg","unix_stream_recvmsg","consume_skb",
              "__skb_datagram_iter","skb_copy_datagram_iter","skb_put","skb_release_data",
              "skb_release_head_state","kfree_skbmem","skb_free_head","__build_skb_around",
              "sock_def_readable","skb_queue_tail","sock_alloc_send_pskb","skb_set_owner_w",
              "sock_wfree","skb_copy_datagram_from_iter","unix_scm_to_skb","skb_unlink",
              "apparmor_socket_sendmsg","security_socket_sendmsg","security_socket_getpeersec_dgram",
              "____sys_sendmsg","___sys_sendmsg","unix_stream_sendmsg","tcp_poll","tcp_stream_memory_free",
              "lock_sock_nested","tcp_release_cb","map_sock_addr","security_socket_getpeername","inet_label_sock_perm",
              "aa_inet_sock_perm","apparmor_socket_getpeername","sock_do_ioctl",
              "udp_poll",
              ]