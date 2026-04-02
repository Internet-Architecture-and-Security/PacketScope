// ============================================================
// TX (Transmit) probes — packet path: transport -> network -> link
// ============================================================

// --------------- Shared TX handlers ---------------

// Transport layer TX: record timestamps for cross-layer latency, increment PPS
static __always_inline int handle_transport_tx(struct sock *sk) {
    struct event_t e;
    __builtin_memset(&e, 0, sizeof(e));

    if (extract_sock_five_tuple(sk, &e, 0) < 0)
        return 0;
    if (!match_five_tuple(&e))
        return 0;

    struct lat_key_t lk;
    build_lat_key(&e, 0, &lk); // 0 = TX

    record_lat(&start_translink, &lk);
    record_lat(&start_transnetwork, &lk);

    agg_increment(AGG_IDX(AGG_PPS, LAYER_TRANS, DIR_TX, e.is_ipv6), 0, &e);
    return 0;
}

// Network layer TX: calc transport->network latency, record for network->link
static __always_inline int handle_network_tx(struct sk_buff *skb) {
    struct event_t e;
    __builtin_memset(&e, 0, sizeof(e));

    if (extract_five_tuple(skb, &e) < 0)
        return 0;
    if (!match_five_tuple(&e))
        return 0;

    struct lat_key_t lk;
    build_lat_key(&e, 0, &lk);

    u64 lat_networktrans = calc_latency(&start_transnetwork, &lk, 1);
    record_lat(&start_link, &lk);

    agg_increment(AGG_IDX(AGG_PPS, LAYER_NETWORK, DIR_TX, e.is_ipv6), 0, &e);
    agg_increment(AGG_IDX(AGG_LAT, CL_NETWORKTRANS, DIR_TX, e.is_ipv6), lat_networktrans, &e);
    return 0;
}

// Link layer TX: calc transport->link + network->link latencies
static __always_inline int handle_link_tx(struct sk_buff *skb) {
    struct event_t e;
    __builtin_memset(&e, 0, sizeof(e));

    if (extract_five_tuple(skb, &e) < 0)
        return 0;
    if (!match_five_tuple(&e))
        return 0;

    struct lat_key_t lk;
    build_lat_key(&e, 0, &lk);

    u64 lat_linktrans = calc_latency(&start_translink, &lk, 1);
    u64 lat_linknetwork = calc_latency(&start_link, &lk, 1);

    agg_increment(AGG_IDX(AGG_PPS, LAYER_LINK, DIR_TX, e.is_ipv6), 0, &e);
    agg_increment(AGG_IDX(AGG_LAT, CL_LINKTRANS, DIR_TX, e.is_ipv6), lat_linktrans, &e);
    agg_increment(AGG_IDX(AGG_LAT, CL_LINKNETWORK, DIR_TX, e.is_ipv6), lat_linknetwork, &e);
    return 0;
}

// --------------- SEC probe definitions ---------------

SEC("fentry/inet_sendmsg")
int BPF_PROG(inet_sendmsg_func, struct socket *sock, struct msghdr *msg,
             size_t size) {
    return handle_transport_tx(BPF_CORE_READ(sock, sk));
}

SEC("fentry/inet6_sendmsg")
int BPF_PROG(inet6_sendmsg_func, struct socket *sock, struct msghdr *msg,
             size_t size) {
    return handle_transport_tx(BPF_CORE_READ(sock, sk));
}

SEC("fentry/tcp_sendmsg")
int BPF_PROG(tcp_sendmsg_func, struct sock *sk, struct msghdr *msg,
             size_t size) {
    return handle_transport_tx(sk);
}

SEC("fentry/udp_sendmsg")
int BPF_PROG(udp_sendmsg_func, struct sock *sk, struct msghdr *msg,
             size_t len) {
    return handle_transport_tx(sk);
}

SEC("fentry/ip_finish_output")
int BPF_PROG(ip_finish_output_func, struct net *net, struct sock *sk,
             struct sk_buff *skb) {
    return handle_network_tx(skb);
}

SEC("fentry/ip6_finish_output")
int BPF_PROG(ip6_finish_output_func, struct net *net, struct sock *sk,
             struct sk_buff *skb) {
    return handle_network_tx(skb);
}

SEC("tp_btf/net_dev_start_xmit")
int BPF_PROG(net_dev_start_xmit_func, struct sk_buff *skb,
             struct net_device *dev) {
    return handle_link_tx(skb);
}
