# MISSING LINE 1
# MISSING LINE 2
# MISSING LINE 3
# MISSING LINE 4
# MISSING LINE 5
# MISSING LINE 6
# MISSING LINE 7
# MISSING LINE 8
# MISSING LINE 9
# MISSING LINE 10
# MISSING LINE 11
# MISSING LINE 12
# MISSING LINE 13
# MISSING LINE 14
# MISSING LINE 15
# MISSING LINE 16
# MISSING LINE 17
# MISSING LINE 18
# MISSING LINE 19
# MISSING LINE 20
# MISSING LINE 21
# MISSING LINE 22
# MISSING LINE 23
# MISSING LINE 24
# MISSING LINE 25
# MISSING LINE 26
# MISSING LINE 27
# MISSING LINE 28
# MISSING LINE 29
# MISSING LINE 30
# MISSING LINE 31
# MISSING LINE 32
# MISSING LINE 33
# MISSING LINE 34
# MISSING LINE 35
# MISSING LINE 36
# MISSING LINE 37
# MISSING LINE 38
# MISSING LINE 39
# MISSING LINE 40
# MISSING LINE 41
# MISSING LINE 42
# MISSING LINE 43
# MISSING LINE 44
# MISSING LINE 45
# MISSING LINE 46
# MISSING LINE 47
# MISSING LINE 48
# MISSING LINE 49
# MISSING LINE 50
# MISSING LINE 51
# MISSING LINE 52
# MISSING LINE 53
# MISSING LINE 54
# MISSING LINE 55
# MISSING LINE 56
# MISSING LINE 57
# MISSING LINE 58
# MISSING LINE 59
# MISSING LINE 60
# MISSING LINE 61
# MISSING LINE 62
# MISSING LINE 63
# MISSING LINE 64
# MISSING LINE 65
# MISSING LINE 66
# MISSING LINE 67
# MISSING LINE 68
# MISSING LINE 69
# MISSING LINE 70
# MISSING LINE 71
# MISSING LINE 72
# MISSING LINE 73
# MISSING LINE 74
# MISSING LINE 75
# MISSING LINE 76
# MISSING LINE 77
# MISSING LINE 78
# MISSING LINE 79
# MISSING LINE 80
# MISSING LINE 81
# MISSING LINE 82
# MISSING LINE 83
# MISSING LINE 84
# MISSING LINE 85
# MISSING LINE 86
# MISSING LINE 87
# MISSING LINE 88
# MISSING LINE 89
# MISSING LINE 90
# MISSING LINE 91
# MISSING LINE 92
# MISSING LINE 93
# MISSING LINE 94
# MISSING LINE 95
# MISSING LINE 96
# MISSING LINE 97
# MISSING LINE 98
# MISSING LINE 99
# MISSING LINE 100
# MISSING LINE 101
# MISSING LINE 102
# MISSING LINE 103
# MISSING LINE 104
# MISSING LINE 105
# MISSING LINE 106
# MISSING LINE 107
# MISSING LINE 108
# MISSING LINE 109
# MISSING LINE 110
# MISSING LINE 111
# MISSING LINE 112
# MISSING LINE 113
# MISSING LINE 114
# MISSING LINE 115
# MISSING LINE 116
# MISSING LINE 117
# MISSING LINE 118
# MISSING LINE 119
# MISSING LINE 120
# MISSING LINE 121
# MISSING LINE 122
# MISSING LINE 123
# MISSING LINE 124
# MISSING LINE 125
# MISSING LINE 126
# MISSING LINE 127
# MISSING LINE 128
# MISSING LINE 129
# MISSING LINE 130
# MISSING LINE 131
# MISSING LINE 132
# MISSING LINE 133
# MISSING LINE 134
# MISSING LINE 135
# MISSING LINE 136
# MISSING LINE 137
# MISSING LINE 138
# MISSING LINE 139
# MISSING LINE 140
# MISSING LINE 141
# MISSING LINE 142
# MISSING LINE 143
# MISSING LINE 144
# MISSING LINE 145
# MISSING LINE 146
# MISSING LINE 147
# MISSING LINE 148
# MISSING LINE 149
# MISSING LINE 150
# MISSING LINE 151
# MISSING LINE 152
# MISSING LINE 153
# MISSING LINE 154
# MISSING LINE 155
# MISSING LINE 156
# MISSING LINE 157
# MISSING LINE 158
# MISSING LINE 159
# MISSING LINE 160
# MISSING LINE 161
# MISSING LINE 162
# MISSING LINE 163
# MISSING LINE 164
# MISSING LINE 165
# MISSING LINE 166
# MISSING LINE 167
# MISSING LINE 168
# MISSING LINE 169
# MISSING LINE 170
# MISSING LINE 171
chat_queues = {}                 # chat_name -> list of (sender, content)
queues_lock = threading.Lock()   # Lock to synchronize chat_queues
listen_chats = []                # Target chats to whitelist (configured at startup)
is_wechat_active = True
wechat_system_prompt = "你是一个温暖专业的AI助理。请用简洁、亲和的语调进行微信回复，多使用 Emoji。"
wechat_reply_delay = 1
wechat_group_at_only = True
wechat_file_push_enabled = True
config_sync_lock = threading.Lock()

# === Supabase REST Client ===
class SupabaseClient:
    """Lightweight direct client for Supabase REST API using httpx."""
    def __init__(self, url: str, anon_key: str):
        self.url = url.rstrip('/')
        self.anon_key = anon_key
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }

    def fetch_settings(self) -> dict:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(
                    f"{self.url}/rest/v1/wechat_settings?id=eq.default",
                    headers=self.headers
                )
                if resp.status_code == 200:
                    rows = resp.json()
                    if rows:
                        return rows[0]
                logger.warning(f"获取 Supabase settings 失败: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.warning(f"获取 Supabase settings 异常: {e}")
        return {}

    def update_status(self, client_status: str, wechat_nickname: str, active_workers: int, system_logs: list[str]) -> bool:
        try:
            payload = {
                "client_status": client_status,
                "last_heartbeat": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "wechat_nickname": wechat_nickname,
                "active_workers": active_workers,
                "system_logs": system_logs,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            with httpx.Client(timeout=10.0) as client:
                resp = client.patch(
                    f"{self.url}/rest/v1/wechat_status?id=eq.default",
                    headers=self.headers,
                    json=payload
                )
                if resp.status_code in [200, 201, 204]:
                    return True
                logger.warning(f"更新 Supabase status 失败: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.warning(f"更新 Supabase status 异常: {e}")
        return False

    def insert_history(self, chat_name: str, sender: str, message: str, response: str, status: str, elapsed_time: float) -> bool:
        try:
            payload = {
                "chat_name": chat_name,
                "sender": sender,
                "message": message,
                "response": response,
                "status": status,
                "elapsed_time": elapsed_time
            }
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(
                    f"{self.url}/rest/v1/wechat_history",
                    headers=self.headers,
                    json=payload
                )
                if resp.status_code in [200, 201, 204]:
                    return True
                logger.warning(f"插入 Supabase history 失败: {resp.status_code} {resp.text}")
        except Exception as e:
# MISSING LINE 253
# MISSING LINE 254
# MISSING LINE 255
# MISSING LINE 256
# MISSING LINE 257
# MISSING LINE 258
# MISSING LINE 259
# MISSING LINE 260
# MISSING LINE 261
# MISSING LINE 262
# MISSING LINE 263
# MISSING LINE 264
# MISSING LINE 265
# MISSING LINE 266
# MISSING LINE 267
# MISSING LINE 268
# MISSING LINE 269
# MISSING LINE 270
# MISSING LINE 271
# MISSING LINE 272
# MISSING LINE 273
# MISSING LINE 274
# MISSING LINE 275
# MISSING LINE 276
# MISSING LINE 277
# MISSING LINE 278
# MISSING LINE 279
# MISSING LINE 280
# MISSING LINE 281
# MISSING LINE 282
# MISSING LINE 283
# MISSING LINE 284
# MISSING LINE 285
# MISSING LINE 286
# MISSING LINE 287
# MISSING LINE 288
# MISSING LINE 289
# MISSING LINE 290
# MISSING LINE 291
# MISSING LINE 292
# MISSING LINE 293
# MISSING LINE 294
# MISSING LINE 295
# MISSING LINE 296
# MISSING LINE 297
# MISSING LINE 298
# MISSING LINE 299
# MISSING LINE 300
# MISSING LINE 301
# MISSING LINE 302
# MISSING LINE 303
# MISSING LINE 304
# MISSING LINE 305
# MISSING LINE 306
# MISSING LINE 307
# MISSING LINE 308
# MISSING LINE 309
# MISSING LINE 310
# MISSING LINE 311
# MISSING LINE 312
# MISSING LINE 313
# MISSING LINE 314
# MISSING LINE 315
# MISSING LINE 316
# MISSING LINE 317
# MISSING LINE 318
# MISSING LINE 319
# MISSING LINE 320
# MISSING LINE 321
# MISSING LINE 322
# MISSING LINE 323
# MISSING LINE 324
# MISSING LINE 325
# MISSING LINE 326
# MISSING LINE 327
# MISSING LINE 328
# MISSING LINE 329
# MISSING LINE 330
# MISSING LINE 331
        except Exception as e:
            logger.warning(f"插入 Supabase history 异常: {e}")
        return False

def get_recent_logs(num_lines: int = 20) -> list[str]:
    log_path = "logs/rpa_client.log"
    if not os.path.exists(log_path):
        return []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            clean_lines = [line.strip() for line in lines[-num_lines:]]
            return clean_lines
    except Exception as e:
        return [f"读取日志错误: {e}"]

def sync_supabase_settings_loop():
    """Background thread to poll Supabase settings and update heartbeats/logs."""
    global listen_chats, is_wechat_active, wechat_system_prompt, wechat_reply_delay, wechat_group_at_only, wechat_file_push_enabled
    supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    logger.info("📡 Supabase 数据库心跳与配置同步线程已启动...")
    
    last_settings_sync = 0.0
    last_heartbeat = 0.0
    
    while True:
        try:
            now = time.time()
            
            # 1. Sync Settings (every 10 seconds)
            if now - last_settings_sync >= 10.0:
                settings = supabase.fetch_settings()
                if settings:
                    new_active = settings.get("is_active", True)
                    listen_str = settings.get("listen_chats", "")
                    new_prompt = settings.get("system_prompt", "")
                    new_delay = settings.get("reply_delay", 1)
                    new_at_only = settings.get("group_at_only", True)
                    new_file_push = settings.get("file_push_enabled", True)
                    
                    with config_sync_lock:
                        is_wechat_active = new_active
                        if listen_str.strip():
                            new_listen = [x.strip() for x in listen_str.split(",") if x.strip()]
                        else:
                            # Fallback to environment variable to avoid dangerous global listening
                            listen_env = os.environ.get("LISTEN_CHATS", "").strip()
                            if listen_env:
                                new_listen = [x.strip() for x in listen_env.split(",") if x.strip()]
                            else:
                                new_listen = []
                        
                        listen_chats = new_listen
                        if new_prompt:
                            wechat_system_prompt = new_prompt
                        wechat_reply_delay = new_delay
                        wechat_group_at_only = new_at_only
                        wechat_file_push_enabled = new_file_push
                
                last_settings_sync = now
            
            # 2. Heartbeat (every 5 seconds)
            if now - last_heartbeat >= 5.0:
                with thinking_lock:
                    num_workers = len(thinking_chats)
                
                logs = get_recent_logs(20)
                
                current_status = "online"
                if wx is None:
                    current_status = "offline"
                
                nickname = ""
                if wx:
                    nickname = getattr(wx, "nickname", "")
                    if not nickname:
                        try:
                            # Attempt to get nickname via wx GetSelfInfo
                            info = wx.GetSelfInfo()
                            nickname = info.get("Name", "")
# MISSING LINE 413
# MISSING LINE 414
# MISSING LINE 415
# MISSING LINE 416
# MISSING LINE 417
# MISSING LINE 418
# MISSING LINE 419
# MISSING LINE 420
# MISSING LINE 421
# MISSING LINE 422
# MISSING LINE 423
# MISSING LINE 424
# MISSING LINE 425
# MISSING LINE 426
# MISSING LINE 427
# MISSING LINE 428
# MISSING LINE 429
# MISSING LINE 430
# MISSING LINE 431
# MISSING LINE 432
# MISSING LINE 433
# MISSING LINE 434
# MISSING LINE 435
# MISSING LINE 436
# MISSING LINE 437
# MISSING LINE 438
# MISSING LINE 439
# MISSING LINE 440
# MISSING LINE 441
# MISSING LINE 442
# MISSING LINE 443
# MISSING LINE 444
# MISSING LINE 445
# MISSING LINE 446
# MISSING LINE 447
# MISSING LINE 448
# MISSING LINE 449
# MISSING LINE 450
# MISSING LINE 451
# MISSING LINE 452
# MISSING LINE 453
# MISSING LINE 454
# MISSING LINE 455
# MISSING LINE 456
# MISSING LINE 457
# MISSING LINE 458
# MISSING LINE 459
# MISSING LINE 460
# MISSING LINE 461
# MISSING LINE 462
# MISSING LINE 463
# MISSING LINE 464
# MISSING LINE 465
# MISSING LINE 466
# MISSING LINE 467
# MISSING LINE 468
# MISSING LINE 469
# MISSING LINE 470
# MISSING LINE 471
# MISSING LINE 472
# MISSING LINE 473
# MISSING LINE 474
# MISSING LINE 475
# MISSING LINE 476
# MISSING LINE 477
# MISSING LINE 478
# MISSING LINE 479
# MISSING LINE 480
# MISSING LINE 481
# MISSING LINE 482
# MISSING LINE 483
# MISSING LINE 484
# MISSING LINE 485
# MISSING LINE 486
# MISSING LINE 487
# MISSING LINE 488
# MISSING LINE 489
# MISSING LINE 490
# MISSING LINE 491
# MISSING LINE 492
# MISSING LINE 493
# MISSING LINE 494
# MISSING LINE 495
# MISSING LINE 496
# MISSING LINE 497
# MISSING LINE 498
# MISSING LINE 499
# MISSING LINE 500
# MISSING LINE 501
# MISSING LINE 502
# MISSING LINE 503
# MISSING LINE 504
# MISSING LINE 505
# MISSING LINE 506
# MISSING LINE 507
# MISSING LINE 508
# MISSING LINE 509
# MISSING LINE 510
# MISSING LINE 511
# MISSING LINE 512
# MISSING LINE 513
# MISSING LINE 514
# MISSING LINE 515
# MISSING LINE 516
# MISSING LINE 517
# MISSING LINE 518
# MISSING LINE 519
# MISSING LINE 520
# MISSING LINE 521
# MISSING LINE 522
# MISSING LINE 523
# MISSING LINE 524
# MISSING LINE 525
# MISSING LINE 526
# MISSING LINE 527
# MISSING LINE 528
# MISSING LINE 529
# MISSING LINE 530
# MISSING LINE 531
# MISSING LINE 532
# MISSING LINE 533
# MISSING LINE 534
# MISSING LINE 535
# MISSING LINE 536
# MISSING LINE 537
# MISSING LINE 538
# MISSING LINE 539
# MISSING LINE 540
# MISSING LINE 541
# MISSING LINE 542
# MISSING LINE 543
# MISSING LINE 544
# MISSING LINE 545
# MISSING LINE 546
# MISSING LINE 547
# MISSING LINE 548
# MISSING LINE 549
# MISSING LINE 550
# MISSING LINE 551
# MISSING LINE 552
# MISSING LINE 553
# MISSING LINE 554
# MISSING LINE 555
# MISSING LINE 556
# MISSING LINE 557
# MISSING LINE 558
# MISSING LINE 559
# MISSING LINE 560
# MISSING LINE 561
# MISSING LINE 562
# MISSING LINE 563
# MISSING LINE 564
# MISSING LINE 565
# MISSING LINE 566
# MISSING LINE 567
# MISSING LINE 568
# MISSING LINE 569
# MISSING LINE 570
# MISSING LINE 571
# MISSING LINE 572
# MISSING LINE 573
# MISSING LINE 574
# MISSING LINE 575
# MISSING LINE 576
# MISSING LINE 577
# MISSING LINE 578
# MISSING LINE 579
# MISSING LINE 580
# MISSING LINE 581
# MISSING LINE 582
# MISSING LINE 583
# MISSING LINE 584
# MISSING LINE 585
# MISSING LINE 586
# MISSING LINE 587
# MISSING LINE 588
# MISSING LINE 589
# MISSING LINE 590
# MISSING LINE 591
# MISSING LINE 592
# MISSING LINE 593
# MISSING LINE 594
# MISSING LINE 595
# MISSING LINE 596
# MISSING LINE 597
# MISSING LINE 598
# MISSING LINE 599
# MISSING LINE 600
# MISSING LINE 601
# MISSING LINE 602
# MISSING LINE 603
# MISSING LINE 604
# MISSING LINE 605
# MISSING LINE 606
# MISSING LINE 607
# MISSING LINE 608
# MISSING LINE 609
# MISSING LINE 610
# MISSING LINE 611
# MISSING LINE 612
# MISSING LINE 613
# MISSING LINE 614
# MISSING LINE 615
# MISSING LINE 616
# MISSING LINE 617
# MISSING LINE 618
# MISSING LINE 619
# MISSING LINE 620
# MISSING LINE 621
# MISSING LINE 622
# MISSING LINE 623
# MISSING LINE 624
# MISSING LINE 625
# MISSING LINE 626
# MISSING LINE 627
# MISSING LINE 628
# MISSING LINE 629
# MISSING LINE 630
# MISSING LINE 631
# MISSING LINE 632
# MISSING LINE 633
# MISSING LINE 634
# MISSING LINE 635
# MISSING LINE 636
# MISSING LINE 637
# MISSING LINE 638
# MISSING LINE 639
# MISSING LINE 640
# MISSING LINE 641
# MISSING LINE 642
# MISSING LINE 643
# MISSING LINE 644
# MISSING LINE 645
# MISSING LINE 646
# MISSING LINE 647
# MISSING LINE 648
# MISSING LINE 649
# MISSING LINE 650
# MISSING LINE 651
# MISSING LINE 652
# MISSING LINE 653
# MISSING LINE 654
# MISSING LINE 655
# MISSING LINE 656
# MISSING LINE 657
# MISSING LINE 658
# MISSING LINE 659
# MISSING LINE 660
# MISSING LINE 661
# MISSING LINE 662
# MISSING LINE 663
# MISSING LINE 664
# MISSING LINE 665
# MISSING LINE 666
# MISSING LINE 667
# MISSING LINE 668
# MISSING LINE 669
# MISSING LINE 670
# MISSING LINE 671
# MISSING LINE 672
# MISSING LINE 673
# MISSING LINE 674
# MISSING LINE 675
# MISSING LINE 676
# MISSING LINE 677
# MISSING LINE 678
# MISSING LINE 679
# MISSING LINE 680
# MISSING LINE 681
# MISSING LINE 682
# MISSING LINE 683
# MISSING LINE 684
# MISSING LINE 685
# MISSING LINE 686
# MISSING LINE 687
# MISSING LINE 688
# MISSING LINE 689
# MISSING LINE 690
# MISSING LINE 691
# MISSING LINE 692
# MISSING LINE 693
# MISSING LINE 694
# MISSING LINE 695
# MISSING LINE 696
# MISSING LINE 697
# MISSING LINE 698
# MISSING LINE 699
# MISSING LINE 700
# MISSING LINE 701
# MISSING LINE 702
# MISSING LINE 703
# MISSING LINE 704
# MISSING LINE 705
# MISSING LINE 706
# MISSING LINE 707
# MISSING LINE 708
# MISSING LINE 709
# MISSING LINE 710
# MISSING LINE 711
# MISSING LINE 712
# MISSING LINE 713
# MISSING LINE 714
# MISSING LINE 715
# MISSING LINE 716
# MISSING LINE 717
# MISSING LINE 718
# MISSING LINE 719
# MISSING LINE 720
# MISSING LINE 721
# MISSING LINE 722
# MISSING LINE 723
# MISSING LINE 724
# MISSING LINE 725
# MISSING LINE 726
# MISSING LINE 727
# MISSING LINE 728
# MISSING LINE 729
# MISSING LINE 730
# MISSING LINE 731
# MISSING LINE 732
# MISSING LINE 733
# MISSING LINE 734
# MISSING LINE 735
# MISSING LINE 736
# MISSING LINE 737
# MISSING LINE 738
# MISSING LINE 739
# MISSING LINE 740
# MISSING LINE 741
# MISSING LINE 742
# MISSING LINE 743
# MISSING LINE 744
# MISSING LINE 745
# MISSING LINE 746
# MISSING LINE 747
# MISSING LINE 748
# MISSING LINE 749
# MISSING LINE 750
# MISSING LINE 751
# MISSING LINE 752
# MISSING LINE 753
# MISSING LINE 754
# MISSING LINE 755
# MISSING LINE 756
# MISSING LINE 757
# MISSING LINE 758
# MISSING LINE 759
# MISSING LINE 760
# MISSING LINE 761
# MISSING LINE 762
# MISSING LINE 763
# MISSING LINE 764
# MISSING LINE 765
# MISSING LINE 766
# MISSING LINE 767
# MISSING LINE 768
# MISSING LINE 769
# MISSING LINE 770
# MISSING LINE 771
# MISSING LINE 772
# MISSING LINE 773
# MISSING LINE 774
# MISSING LINE 775
# MISSING LINE 776
# MISSING LINE 777
# MISSING LINE 778
# MISSING LINE 779
# MISSING LINE 780
# MISSING LINE 781
# MISSING LINE 782
# MISSING LINE 783
# MISSING LINE 784
# MISSING LINE 785
# MISSING LINE 786
# MISSING LINE 787
# MISSING LINE 788
# MISSING LINE 789
# MISSING LINE 790
# MISSING LINE 791
# MISSING LINE 792
# MISSING LINE 793
# MISSING LINE 794
# MISSING LINE 795
# MISSING LINE 796
# MISSING LINE 797
# MISSING LINE 798
# MISSING LINE 799
# MISSING LINE 800
# MISSING LINE 801
# MISSING LINE 802
# MISSING LINE 803
# MISSING LINE 804
# MISSING LINE 805
# MISSING LINE 806
# MISSING LINE 807
# MISSING LINE 808
# MISSING LINE 809
# MISSING LINE 810
# MISSING LINE 811
# MISSING LINE 812
# MISSING LINE 813
# MISSING LINE 814
# MISSING LINE 815
# MISSING LINE 816
# MISSING LINE 817
# MISSING LINE 818
# MISSING LINE 819
# MISSING LINE 820
# MISSING LINE 821
# MISSING LINE 822
# MISSING LINE 823
# MISSING LINE 824
# MISSING LINE 825
# MISSING LINE 826
# MISSING LINE 827
# MISSING LINE 828
# MISSING LINE 829
# MISSING LINE 830
# MISSING LINE 831
# MISSING LINE 832
# MISSING LINE 833
# MISSING LINE 834
# MISSING LINE 835
# MISSING LINE 836
# MISSING LINE 837
# MISSING LINE 838
# MISSING LINE 839
# MISSING LINE 840
# MISSING LINE 841
# MISSING LINE 842
# MISSING LINE 843
# MISSING LINE 844
# MISSING LINE 845
# MISSING LINE 846
# MISSING LINE 847
# MISSING LINE 848
# MISSING LINE 849
# MISSING LINE 850
# MISSING LINE 851
# MISSING LINE 852
# MISSING LINE 853
# MISSING LINE 854
# MISSING LINE 855
# MISSING LINE 856
# MISSING LINE 857
# MISSING LINE 858
# MISSING LINE 859
# MISSING LINE 860
# MISSING LINE 861
# MISSING LINE 862
# MISSING LINE 863
# MISSING LINE 864
# MISSING LINE 865
# MISSING LINE 866
# MISSING LINE 867
# MISSING LINE 868
# MISSING LINE 869
# MISSING LINE 870
# MISSING LINE 871
# MISSING LINE 872
# MISSING LINE 873
# MISSING LINE 874
# MISSING LINE 875
# MISSING LINE 876
# MISSING LINE 877
# MISSING LINE 878
# MISSING LINE 879
# MISSING LINE 880
# MISSING LINE 881
# MISSING LINE 882
# MISSING LINE 883
# MISSING LINE 884
# MISSING LINE 885
# MISSING LINE 886
# MISSING LINE 887
# MISSING LINE 888
# MISSING LINE 889
# MISSING LINE 890
# MISSING LINE 891
# MISSING LINE 892
# MISSING LINE 893
# MISSING LINE 894
# MISSING LINE 895
# MISSING LINE 896
# MISSING LINE 897
# MISSING LINE 898
# MISSING LINE 899
# MISSING LINE 900
# MISSING LINE 901
# MISSING LINE 902
# MISSING LINE 903
# MISSING LINE 904
# MISSING LINE 905
# MISSING LINE 906
# MISSING LINE 907
# MISSING LINE 908
# MISSING LINE 909
# MISSING LINE 910
# MISSING LINE 911
# MISSING LINE 912
# MISSING LINE 913
# MISSING LINE 914
# MISSING LINE 915
# MISSING LINE 916
# MISSING LINE 917
# MISSING LINE 918
# MISSING LINE 919
# MISSING LINE 920
# MISSING LINE 921
# MISSING LINE 922
# MISSING LINE 923
# MISSING LINE 924
# MISSING LINE 925
# MISSING LINE 926
# MISSING LINE 927
# MISSING LINE 928
# MISSING LINE 929
# MISSING LINE 930
# MISSING LINE 931
# MISSING LINE 932
# MISSING LINE 933
# MISSING LINE 934
# MISSING LINE 935
# MISSING LINE 936
# MISSING LINE 937
# MISSING LINE 938
# MISSING LINE 939
# MISSING LINE 940
# MISSING LINE 941
# MISSING LINE 942
# MISSING LINE 943
# MISSING LINE 944
# MISSING LINE 945
# MISSING LINE 946
# MISSING LINE 947
# MISSING LINE 948
# MISSING LINE 949
# MISSING LINE 950
# MISSING LINE 951
# MISSING LINE 952
# MISSING LINE 953
# MISSING LINE 954
# MISSING LINE 955
# MISSING LINE 956
# MISSING LINE 957
# MISSING LINE 958
# MISSING LINE 959
# MISSING LINE 960
# MISSING LINE 961
# MISSING LINE 962
# MISSING LINE 963
# MISSING LINE 964
# MISSING LINE 965
# MISSING LINE 966
# MISSING LINE 967
# MISSING LINE 968
# MISSING LINE 969
# MISSING LINE 970
# MISSING LINE 971
# MISSING LINE 972
# MISSING LINE 973
# MISSING LINE 974
# MISSING LINE 975
# MISSING LINE 976
# MISSING LINE 977
# MISSING LINE 978
# MISSING LINE 979
# MISSING LINE 980
# MISSING LINE 981
# MISSING LINE 982
# MISSING LINE 983
# MISSING LINE 984
# MISSING LINE 985
# MISSING LINE 986
# MISSING LINE 987
# MISSING LINE 988
# MISSING LINE 989
# MISSING LINE 990
# MISSING LINE 991
# MISSING LINE 992
# MISSING LINE 993
# MISSING LINE 994
# MISSING LINE 995
# MISSING LINE 996
# MISSING LINE 997
# MISSING LINE 998
# MISSING LINE 999
# MISSING LINE 1000
# MISSING LINE 1001
# MISSING LINE 1002
# MISSING LINE 1003
# MISSING LINE 1004
# MISSING LINE 1005
# MISSING LINE 1006
# MISSING LINE 1007
# MISSING LINE 1008
# MISSING LINE 1009
# MISSING LINE 1010
# MISSING LINE 1011
# MISSING LINE 1012
# MISSING LINE 1013
# MISSING LINE 1014
# MISSING LINE 1015
# MISSING LINE 1016
# MISSING LINE 1017
# MISSING LINE 1018
# MISSING LINE 1019
# MISSING LINE 1020
# MISSING LINE 1021
# MISSING LINE 1022
# MISSING LINE 1023
# MISSING LINE 1024
# MISSING LINE 1025
# MISSING LINE 1026
# MISSING LINE 1027
# MISSING LINE 1028
# MISSING LINE 1029
# MISSING LINE 1030
# MISSING LINE 1031
        logger.info("⏳ 绑定失败，将在 5 秒后继续重试...")
        time.sleep(5)

def main():
    global listen_chats
    print("=" * 75)
    print("🤖 WeChat PC 4.x RPA + LangGraph 生产级多线程自愈守护进程")
    print("=" * 75)
    print("💡 部署要点：")
    print("   1. 请确保您的 Windows 电脑上已登录官方 PC 版微信 4.x 客户端。")
    print("   2. 请确保微信窗口处于可见状态（不可最小化至系统托盘，建议常驻背景或半屏显示）。")
    print("   3. 所有网络请求异步并发执行，主 GUI 操作单线程排队，绝无竞态冲突。")
    print("=" * 75)

    # Initial WeChat bind
    if not bind_wechat():
        logger.warning("首次绑定失败，进入自愈自动搜索程序...")
        self_healing_reconnect()

    # Load initial settings from Supabase
    global is_wechat_active
    supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    initial_settings = supabase.fetch_settings()
    if initial_settings:
        is_wechat_active = initial_settings.get("is_active", True)
        listen_str = initial_settings.get("listen_chats", "")
        if listen_str.strip():
            listen_chats = [item.strip() for item in listen_str.split(",") if item.strip()]
        else:
            # Fallback to environment variable to avoid dangerous global listening
            listen_env = os.environ.get("LISTEN_CHATS", "").strip()
            if listen_env:
                listen_chats = [item.strip() for item in listen_env.split(",") if item.strip()]
                logger.info(f"🚀 [数据库空值回退] 已回退至环境变量监控名单：{listen_chats}")
            else:
                logger.info("⚠️ [数据库空值] 未配置白名单，且无环境变量回退，默认使用全局托管监听模式！")
                listen_chats = []
        logger.info(f"🚀 [数据库配置] 成功加载初始名单 (当前状态={'启用' if is_wechat_active else '禁用'})：{listen_chats}")
    else:
        # Fallback
        listen_env = os.environ.get("LISTEN_CHATS", "").strip()
        if listen_env:
            listen_chats = [item.strip() for item in listen_env.split(",") if item.strip()]
            logger.info(f"🚀 [环境配置] 已设定监听名单：{listen_chats}")
        else:
            logger.info("🚀 [环境配置] 全局自动监听模式 (白名单为空)")
            listen_chats = []

    # Start database heartbeat and configuration sync thread
    sync_thread = threading.Thread(target=sync_supabase_settings_loop, daemon=True)
    sync_thread.start()

    logger.info("⚡ 微信 RPA 生产级服务已正式启动，按 Ctrl+C 可安全退出。")
    
    while True:
        # === 1. UI Thread Consumer: Consume ready AI replies from the queue ===
        try:
            while not reply_queue.empty():
                chat_name, reply, target_files = reply_queue.get_nowait()
                logger.info(f"📤 [UI 发送队列] 正在回复给 [{chat_name}]...")
                
                # Active UI interaction to switch and send msg
                wx.ChatWith(chat_name)
                
                # Fetch customized delay
                with config_sync_lock:
                    delay = wechat_reply_delay
                if delay > 0:
                    logger.info(f"⏳ [延时回复] 正在模拟人类输入，等待 {delay} 秒后发出回复...")
                    time.sleep(delay)
                else:
                    time.sleep(0.3)
                
                # Send text reply
                wx.SendMsg(reply)
                logger.info(f"✅ 文字消息成功送达！[{chat_name}]")
                
                # If we intercepted explicit file sending tool calls
                if target_files:
                    with config_sync_lock:
                        file_push_allowed = wechat_file_push_enabled
# MISSING LINE 1113
# MISSING LINE 1114
# MISSING LINE 1115
# MISSING LINE 1116
# MISSING LINE 1117
# MISSING LINE 1118
# MISSING LINE 1119
# MISSING LINE 1120
# MISSING LINE 1121
# MISSING LINE 1122
# MISSING LINE 1123
# MISSING LINE 1124
# MISSING LINE 1125
# MISSING LINE 1126
# MISSING LINE 1127
# MISSING LINE 1128
# MISSING LINE 1129
# MISSING LINE 1130
# MISSING LINE 1131
# MISSING LINE 1132
# MISSING LINE 1133
# MISSING LINE 1134
# MISSING LINE 1135
# MISSING LINE 1136
# MISSING LINE 1137
# MISSING LINE 1138
# MISSING LINE 1139
# MISSING LINE 1140
# MISSING LINE 1141
# MISSING LINE 1142
# MISSING LINE 1143
# MISSING LINE 1144
# MISSING LINE 1145
# MISSING LINE 1146
# MISSING LINE 1147
# MISSING LINE 1148
# MISSING LINE 1149
# MISSING LINE 1150
# MISSING LINE 1151
# MISSING LINE 1152
# MISSING LINE 1153
# MISSING LINE 1154
# MISSING LINE 1155
# MISSING LINE 1156
# MISSING LINE 1157
# MISSING LINE 1158
# MISSING LINE 1159
# MISSING LINE 1160
# MISSING LINE 1161
# MISSING LINE 1162
# MISSING LINE 1163
# MISSING LINE 1164
# MISSING LINE 1165
# MISSING LINE 1166
# MISSING LINE 1167
# MISSING LINE 1168
# MISSING LINE 1169
# MISSING LINE 1170
# MISSING LINE 1171
# MISSING LINE 1172
# MISSING LINE 1173
# MISSING LINE 1174
# MISSING LINE 1175
# MISSING LINE 1176
# MISSING LINE 1177
# MISSING LINE 1178
# MISSING LINE 1179
# MISSING LINE 1180
# MISSING LINE 1181
# MISSING LINE 1182
# MISSING LINE 1183
# MISSING LINE 1184
# MISSING LINE 1185
# MISSING LINE 1186
# MISSING LINE 1187
# MISSING LINE 1188
# MISSING LINE 1189
# MISSING LINE 1190
# MISSING LINE 1191
                        file_push_allowed = wechat_file_push_enabled
                    
                    if not file_push_allowed:
                        logger.warning("🚫 [RPA 工具雷达] 大模型试图发送文件，但自动文件发送功能已在后台被管理员禁用！")
                        target_files = []
                    else:
                        logger.info(f"📂 [RPA 工具雷达] 拦截到大模型显式发送文件请求，共 {len(target_files)} 个...")
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    workspace_dir = os.path.join(script_dir, "workspace")
                    
                    # Compute thread_id dynamically to locate the thread-isolated folder
                    namespace = uuid.UUID(FREDDY_SUB_UUID)
                    thread_id = str(uuid.uuid5(namespace, chat_name))
                    
                    for filepath in target_files:
                        # Clean prefix, keep the subfolder structure (e.g. umx-logo/logo-full.svg)
                        rel_path = filepath.replace("/workspace/", "", 1)
                        
                        # Generate 4 robust lookup paths to prevent any subdirectory or thread-isolation mismatch
                        lookups = [
                            # A: Thread-isolated exact path (e.g. workspace/<thread_id>/umx-logo/logo-full.svg)
                            os.path.join(workspace_dir, thread_id, rel_path),
                            # B: Thread-isolated basename fallback (e.g. workspace/<thread_id>/logo-full.svg)
                            os.path.join(workspace_dir, thread_id, os.path.basename(rel_path)),
                            # C: Root workspace exact path (e.g. workspace/umx-logo/logo-full.svg)
                            os.path.join(workspace_dir, rel_path),
                            # D: Root workspace basename fallback (e.g. workspace/logo-full.svg)
                            os.path.join(workspace_dir, os.path.basename(rel_path))
                        ]
                        
                        local_filepath = None
                        for path in lookups:
                            # Normalize path slashes for Windows compatibility
                            path = os.path.normpath(path)
                            if os.path.exists(path):
                                local_filepath = path
                                break
                        
                        if local_filepath:
                            logger.info(f"   - 正在提取并传输文件: {local_filepath}")
                            time.sleep(1.0)  # Settle UI
                            wx.SendFiles(local_filepath)
                            logger.info(f"   🎉 文件 [{os.path.basename(local_filepath)}] 成功推送给 [{chat_name}]！")
                        else:
                            logger.warning(f"   ⚠️ 未在本地工作区找到匹配文件。尝试过的路径:")
                            for p in lookups:
                                logger.warning(f"     - {os.path.normpath(p)}")
                
                # Release lock on this chat room to allow future messages
                with thinking_lock:
                    thinking_chats.discard(chat_name)
                
                # Check if new messages arrived in the queue during AI thinking, and trigger next sequential run!
                with queues_lock:
                    has_more = bool(chat_queues.get(chat_name))
                if has_more:
                    logger.info(f"🔄 [{chat_name}] 在AI思考期间收到了新消息，自动触发下一轮顺序回复...")
                    trigger_thinking_for_chat(chat_name)
                    
        except Exception as e:
            logger.error(f"💥 UI发送阶段发生致命异常: {e}")
            self_healing_reconnect()
            continue

        # === 2. UI Thread Producer: Poll WeChat for unread messages ===
        try:
            with config_sync_lock:
                active = is_wechat_active
                whitelist = list(listen_chats)

            if active:
                sessions = wx.GetSession()
                for s in sessions:
                    # Identify sessions with unread messages
                    if not s.isnew:
                        continue
                    
                    # Whitelist check
                    if whitelist and s.name not in whitelist:
                        continue
                    
                    logger.info(f"💬 收到 [{s.name}] 的未读消息！进行 UI 切换读取中...")
                    wx.ChatWith(s.name)
                    time.sleep(0.4)
                    
                    msgs = wx.GetAllMessage()
                    if not msgs:
                        continue
                    
                    new_count = s.new_count if s.new_count > 0 else 1
                    unread_msgs = msgs[-new_count:]
                    
                    # Extract and validate unread messages
                    valid_msgs = []
                    for m in unread_msgs:
                        # Loopback protection: Filter out self messages (except in File Transfer Helper for self testing)
                        if m.attr == "self" and s.name != "文件传输助手":
                            continue
                        if m.attr == "system" or m.type == "time":
                            continue
                        
                        # Group chat check: if it is a group chat message, it MUST @ us!
                        # We identify group chat messages when s.name (session name) is different from m.sender (sender name)
                        is_group_msg = (m.sender != s.name and s.name != "文件传输助手")
                        content = m.content
                        
                        if is_group_msg:
                            our_name = wx.nickname if (wx and hasattr(wx, "nickname")) else "扎特 Freddy"
                            mention_1 = f"@{our_name}"
                            mention_2 = f"@{our_name.split()[-1]}" if our_name and len(our_name.split()) > 1 else mention_1
                            
                            # Perform mention check
                            if mention_1 not in content and mention_2 not in content:
                                continue
                                
                            logger.info(f"🔔 [群聊@提醒] 在群聊 [{s.name}] 中收到来自 [{m.sender}] 的 @ 提问！")
                            # Clean up the @ mention prefix and WeChat zero-width spaces (\u2005) for better prompt quality
                            content = content.replace(mention_1, "").replace(mention_2, "").replace("\u2005", "").strip()

                        valid_msgs.append((m.sender, content))
                    
                    if not valid_msgs:
                        continue
                    
                    # Add to chat room sequential queue
                    with queues_lock:
                        if s.name not in chat_queues:
                            chat_queues[s.name] = []
                        chat_queues[s.name].extend(valid_msgs)
                        logger.info(f"📩 [{s.name}] 队列新增 {len(valid_msgs)} 条消息，当前队列长度: {len(chat_queues[s.name])}")
                    
                    # Trigger sequential AI execution
                    trigger_thinking_for_chat(s.name)
                        
        except KeyboardInterrupt:
            logger.info("👋 收到退出指令，微信 RPA 监听守护进程已安全停止。")
            break
        except Exception as e:
            logger.error(f"💥 监听主循环捕获未知错误: {e}")
            self_healing_reconnect()
            continue
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()

